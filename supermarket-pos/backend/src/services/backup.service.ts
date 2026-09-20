import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID, createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { ValidationError, NotFoundError } from "../utils/errors";
import { logger } from "../utils/logger";

const exec = promisify(execFile);
export const backupDir = path.resolve(process.env.BACKUP_DIR ?? "backups");
const uploads = path.resolve("uploads");
type Manifest = {
  id: string;
  createdAt: string;
  type: "MANUAL" | "AUTOMATIC";
  status: "RUNNING" | "COMPLETE" | "FAILED";
  sizeBytes?: number;
  sha256?: string;
  error?: string;
};
let busy = false;
const validId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw new ValidationError("Invalid backup ID");
  return id;
};
function pgEnv(database?: string) {
  const url = new URL(env.databaseUrl);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database ?? decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "10",
    ...(url.searchParams.has("sslmode")
      ? { PGSSLMODE: url.searchParams.get("sslmode")! }
      : {}),
  };
}
export async function pgTool(tool: string, args: string[], database?: string) {
  const file = process.env.PG_BIN_DIR
    ? path.join(
        process.env.PG_BIN_DIR,
        tool + (process.platform === "win32" ? ".exe" : ""),
      )
    : tool;
  return exec(file, args, {
    env: pgEnv(database),
    timeout: 15 * 60 * 1000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
}
const manifestPath = (id: string) =>
  path.join(backupDir, `${validId(id)}.json`);
async function save(m: Manifest) {
  await fs.writeFile(manifestPath(m.id), JSON.stringify(m, null, 2), {
    mode: 0o600,
  });
}
async function digest(file: string) {
  const { createReadStream } = await import("fs");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export async function listBackups() {
  await fs.mkdir(backupDir, { recursive: true });
  const files = (await fs.readdir(backupDir)).filter((f) =>
    /^[0-9a-f-]{36}\.json$/.test(f),
  );
  const rows = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(
          await fs.readFile(path.join(backupDir, f), "utf8"),
        ) as Manifest;
      } catch {
        return null;
      }
    }),
  );
  return rows
    .filter((m): m is Manifest => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function backupFile(id: string) {
  const m = JSON.parse(
    await fs.readFile(manifestPath(id), "utf8").catch(() => {
      throw new NotFoundError("Backup not found");
    }),
  ) as Manifest;
  if (m.status !== "COMPLETE")
    throw new ValidationError("Backup is not complete");
  const file = path.join(backupDir, `${id}.dump`);
  if ((await digest(file)) !== m.sha256)
    throw new ValidationError("Backup checksum mismatch");
  return { file, manifest: m };
}
export async function createBackup(
  type: "MANUAL" | "AUTOMATIC",
  userId?: string,
) {
  if (busy) throw new ValidationError("A backup or restore is already running");
  busy = true;
  const m: Manifest = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    status: "RUNNING",
  };
  try {
    await fs.mkdir(backupDir, { recursive: true });
    await save(m);
    const file = path.join(backupDir, `${m.id}.dump`);
    await pgTool("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      file,
    ]);
    await pgTool("pg_restore", ["--list", file]);
    await fs
      .cp(uploads, path.join(backupDir, `${m.id}.uploads`), { recursive: true })
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
      });
    m.sizeBytes = (await fs.stat(file)).size;
    m.sha256 = await digest(file);
    m.status = "COMPLETE";
    await save(m);
    await prisma.backup.create({
      data: {
        id: m.id,
        filename: `${m.id}.dump`,
        sizeBytes: m.sizeBytes,
        type,
        createdBy: userId,
      },
    });
    return m;
  } catch (e) {
    m.status = "FAILED";
    m.error =
      "Backup failed. Check PostgreSQL tools, connection, disk space and server logs.";
    await save(m).catch(() => {});
    logger.error("Backup failed", {
      message: e instanceof Error ? e.message : "Unknown error",
    });
    throw new ValidationError(m.error);
  } finally {
    busy = false;
  }
}
export async function restoreBackup(
  id: string,
  confirmation: string,
  userId: string,
) {
  if (confirmation !== "RESTORE TO NEW DATABASE")
    throw new ValidationError("Type RESTORE TO NEW DATABASE to confirm");
  if (busy) throw new ValidationError("A backup or restore is already running");
  busy = true;
  try {
    const { file } = await backupFile(id);
    const target = `pos_restore_${Date.now()}_${randomUUID().slice(0, 8)}`;
    await pgTool("createdb", ["--template=template0", target]);
    await pgTool("pg_restore", [
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
      "--dbname",
      target,
      file,
    ]);
    // Restoring always stages a separate DB. Live registers keep using the original.
    await prisma.auditLog.create({
      data: {
        userId,
        action: "BACKUP_RESTORED",
        entityType: "Backup",
        entityId: id,
        newValue: { target },
      },
    });
    return {
      database: target,
      uploadsDirectory: `${id}.uploads`,
      message:
        "Restored into a separate database. Stop the API, switch DATABASE_URL, restore the matching uploads directory, then restart after validation.",
    };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof NotFoundError) throw e;
    logger.error("Restore failed", {
      message: e instanceof Error ? e.message : "Unknown error",
    });
    throw new ValidationError(
      "Restore failed; the live database was not changed. Check server logs.",
    );
  } finally {
    busy = false;
  }
}
export function startBackupScheduler() {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS ?? 0);
  if (!Number.isFinite(hours) || hours < 0 || hours > 720)
    throw new Error("BACKUP_INTERVAL_HOURS must be 0..720");
  if (!hours) return;
  const tick = async () => {
    try {
      const rows = await listBackups();
      const last = rows.find((r) => r.status === "COMPLETE");
      if (
        !busy &&
        (!last || Date.now() - Date.parse(last.createdAt) >= hours * 3600000)
      )
        await createBackup("AUTOMATIC");
    } catch (e) {
      logger.error("Scheduled backup failed", {
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  void tick();
  return timer;
}

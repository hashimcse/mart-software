import { useEffect, useState } from "react";
import { apiRequest, apiDownload } from "../lib/api";
import { useAuth } from "../context/AuthContext";
type Backup = {
  id: string;
  createdAt: string;
  type: string;
  status: string;
  sizeBytes?: number;
  error?: string;
};
export default function Backups() {
  const { user } = useAuth();
  const allowed = user?.permissions.includes("backup.manage");
  const [rows, setRows] = useState<Backup[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(""),
    [confirmation, setConfirmation] = useState("");
  async function load() {
    try {
      setRows(await apiRequest<Backup[]>("/backups"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/backups", { method: "POST" });
      await load();
      setMessage("Backup completed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<{ database: string; message: string }>(
        `/backups/${selected}/restore`,
        { method: "POST", body: { confirmation } },
      );
      setMessage(`${r.database}: ${r.message}`);
      setSelected("");
      setConfirmation("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return <p className="p-8">Your role does not have access to backups.</p>;
  return (
    <div className="space-y-6 p-8">
      <header className="flex justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Backups</h1>
          <p className="mt-2 text-sm text-ink/60">
            Database snapshots and recovery history
          </p>
        </div>
        <button
          disabled={busy}
          className="rounded bg-ledger-600 px-5 py-2 text-white disabled:opacity-50"
          onClick={() => void create()}
        >
          {busy ? "Working…" : "Create backup"}
        </button>
      </header>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded bg-ledger-50 p-4">
          {message}
        </p>
      )}
      <p className="text-sm text-ink/60">
        Scheduled backups run while the server is running, at the interval
        configured by your administrator. Keep an additional copy of the backup
        folder on another device; it contains the database and matching product
        images.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Created", "Type", "Status", "Size", "Actions"].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-4">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td>{r.type}</td>
                <td title={r.error}>{r.status}</td>
                <td>
                  {r.sizeBytes ? (r.sizeBytes / 1024).toFixed(1) + " KB" : "—"}
                </td>
                <td>
                  {r.status === "COMPLETE" && (
                    <div className="flex gap-3">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void apiDownload(
                            `/backups/${r.id}/download`,
                            `${r.id}.dump`,
                          ).catch((e) => setError(e.message))
                        }
                      >
                        Download DB
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(r.id);
                          setConfirmation("");
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-ink/50">No backups yet.</p>}
      </div>
      {selected && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold">Restore a separate copy</h2>
          <p className="my-3 text-sm">
            This creates a new database for validation. An administrator can
            switch the store to it after checking the restored data. Type
            RESTORE TO NEW DATABASE to continue.
          </p>
          <input
            aria-label="Restore confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded border p-2"
          />
          <div className="mt-3 flex gap-3">
            <button
              disabled={busy || confirmation !== "RESTORE TO NEW DATABASE"}
              onClick={() => void restore()}
              className="rounded bg-ink px-4 py-2 text-white disabled:opacity-40"
            >
              Restore copy
            </button>
            <button onClick={() => setSelected("")}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}

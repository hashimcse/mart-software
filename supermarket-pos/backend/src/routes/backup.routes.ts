import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  listBackups,
  createBackup,
  backupFile,
  restoreBackup,
} from "../services/backup.service";
const router = Router();
router.use(authenticate, requirePermission("backup.manage"));
router.get(
  "/",
  asyncHandler(async (_req, res) => res.json(await listBackups())),
);
router.get(
  "/:id/download",
  asyncHandler(async (req, res) => {
    const { file } = await backupFile(req.params.id);
    res.download(file);
  }),
);
router.use(
  rateLimit({
    windowMs: 60000,
    limit: 3,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
router.post(
  "/",
  asyncHandler(async (req, res) =>
    res.status(201).json(await createBackup("MANUAL", req.user!.sub)),
  ),
);
router.post(
  "/:id/restore",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ confirmation: z.literal("RESTORE TO NEW DATABASE") })
      .parse(req.body);
    res.json(
      await restoreBackup(req.params.id, body.confirmation, req.user!.sub),
    );
  }),
);
export default router;

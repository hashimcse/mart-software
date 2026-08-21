import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { updateSettingSchema } from '../schemas/settings.schema';

const router = Router();
router.use(authenticate);

// Reads are open to any authenticated user — the POS screen needs store
// name/receipt footer/printer mode to render receipts, not just Settings
// page visitors. Writes require settings.manage.
router.get('/', settingsController.list);
router.put('/:key', requirePermission('settings.manage'), validateBody(updateSettingSchema), settingsController.update);
router.post('/test-print', requirePermission('settings.manage'), settingsController.testPrint);

export default router;

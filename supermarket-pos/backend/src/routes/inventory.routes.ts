import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { adjustmentSchema, stockRemovalSchema } from '../schemas/inventory.schema';

const router = Router();
router.use(authenticate);

router.get('/movements', requireAnyPermission('inventory.manage', 'reports.view'), inventoryController.listMovements);
router.get('/low-stock', requireAnyPermission('inventory.manage', 'reports.view'), inventoryController.lowStock);
router.get('/out-of-stock', requireAnyPermission('inventory.manage', 'reports.view'), inventoryController.outOfStock);
router.get('/expiring', requireAnyPermission('inventory.manage', 'reports.view'), inventoryController.expiring);
router.get('/valuation', requireAnyPermission('inventory.manage', 'profits.view'), inventoryController.valuation);

router.post('/adjustments', requirePermission('inventory.adjust'), validateBody(adjustmentSchema), inventoryController.adjust);
router.post('/damaged', requirePermission('inventory.manage'), validateBody(stockRemovalSchema), inventoryController.markDamaged);
router.post('/expired', requirePermission('inventory.manage'), validateBody(stockRemovalSchema), inventoryController.markExpired);

export default router;

import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createPurchaseSchema } from '../schemas/purchase.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('purchases.manage'), purchaseController.list);
router.get('/:id', requirePermission('purchases.manage'), purchaseController.getOne);
router.post('/', requirePermission('purchases.manage'), validateBody(createPurchaseSchema), purchaseController.create);
router.post('/:id/receive', requirePermission('purchases.manage'), purchaseController.receive);
router.post('/:id/invoice', requirePermission('purchases.manage'), purchaseController.invoice);
router.post('/:id/cancel', requirePermission('purchases.manage'), purchaseController.cancel);

export default router;

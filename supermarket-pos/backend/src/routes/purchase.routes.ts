import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller';
import * as purchaseReturnController from '../controllers/purchaseReturn.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createPurchaseSchema } from '../schemas/purchase.schema';
import { createPurchaseReturnSchema } from '../schemas/return.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('purchases.manage'), purchaseController.list);
router.get('/:id', requirePermission('purchases.manage'), purchaseController.getOne);
router.post('/', requirePermission('purchases.manage'), validateBody(createPurchaseSchema), purchaseController.create);
router.post('/:id/receive', requirePermission('purchases.manage'), purchaseController.receive);
router.post('/:id/invoice', requirePermission('purchases.manage'), purchaseController.invoice);
router.post('/:id/cancel', requirePermission('purchases.manage'), purchaseController.cancel);
router.get('/:purchaseId/returnable', requirePermission('purchases.manage'), purchaseReturnController.returnableForPurchase);
router.post(
  '/:id/returns',
  requirePermission('purchases.manage'),
  validateBody(createPurchaseReturnSchema.omit({ purchaseId: true })),
  purchaseReturnController.create,
);

export default router;

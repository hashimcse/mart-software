import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import * as receiptController from '../controllers/receipt.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createSaleSchema } from '../schemas/sale.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('sales.create'), saleController.list);
router.get('/:id', requirePermission('sales.create'), saleController.getOne);
router.post('/', requirePermission('sales.create'), validateBody(createSaleSchema), saleController.create);
router.get('/:id/receipt.escpos', requirePermission('sales.create'), receiptController.downloadEscPos);
router.post('/:id/print', requirePermission('sales.create'), receiptController.printNetwork);

export default router;

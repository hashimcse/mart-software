import { Router } from 'express';
import * as heldBillController from '../controllers/heldBill.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { holdBillSchema } from '../schemas/heldBill.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('sales.create'), heldBillController.list);
router.post('/', requirePermission('sales.create'), validateBody(holdBillSchema), heldBillController.create);
router.get('/:id', requirePermission('sales.create'), heldBillController.getOne);
router.delete('/:id', requirePermission('sales.create'), heldBillController.remove);

export default router;

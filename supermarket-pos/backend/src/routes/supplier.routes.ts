import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema, supplierPaymentSchema } from '../schemas/supplier.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('suppliers.manage'), supplierController.list);
router.get('/:id', requirePermission('suppliers.manage'), supplierController.getOne);
router.post('/', requirePermission('suppliers.manage'), validateBody(createSupplierSchema), supplierController.create);
router.patch('/:id', requirePermission('suppliers.manage'), validateBody(updateSupplierSchema), supplierController.update);
router.post(
  '/:id/payments',
  requireAnyPermission('suppliers.manage', 'purchases.manage'),
  validateBody(supplierPaymentSchema),
  supplierController.recordPayment,
);

export default router;

import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerPaymentSchema,
  loyaltyAdjustmentSchema,
} from '../schemas/customer.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('customers.manage'), customerController.list);
router.get('/:id', requirePermission('customers.manage'), customerController.getOne);
router.post('/', requirePermission('customers.manage'), validateBody(createCustomerSchema), customerController.create);
router.patch('/:id', requirePermission('customers.manage'), validateBody(updateCustomerSchema), customerController.update);
router.post(
  '/:id/payments',
  requirePermission('customers.manage'),
  validateBody(customerPaymentSchema),
  customerController.recordPayment,
);
router.post(
  '/:id/loyalty-adjustments',
  requirePermission('customers.manage'),
  validateBody(loyaltyAdjustmentSchema),
  customerController.adjustLoyalty,
);

export default router;

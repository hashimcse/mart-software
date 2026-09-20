import { Router } from 'express';
import * as cashSessionController from '../controllers/cashSession.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { openSessionSchema, cashMovementSchema, closeSessionSchema } from '../schemas/cashSession.schema';

const router = Router();
router.use(authenticate);

router.get('/open', requirePermission('cash_register.manage'), cashSessionController.getOpen);
router.get('/', requirePermission('cash_register.manage'), cashSessionController.list);
router.get('/:id', requirePermission('cash_register.manage'), cashSessionController.getOne);
router.post('/', requirePermission('cash_register.manage'), validateBody(openSessionSchema), cashSessionController.open);
router.post('/:id/movements', requirePermission('cash_register.manage'), validateBody(cashMovementSchema), cashSessionController.addMovement);
router.post('/:id/close', requirePermission('cash_register.manage'), validateBody(closeSessionSchema), cashSessionController.close);

export default router;

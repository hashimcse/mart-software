import { Router } from 'express';
import * as returnController from '../controllers/return.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createReturnSchema } from '../schemas/return.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('refunds.process'), returnController.list);
router.get('/:id', requirePermission('refunds.process'), returnController.getOne);
router.post('/', requirePermission('refunds.process'), validateBody(createReturnSchema), returnController.create);

export default router;

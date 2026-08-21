import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createUserSchema } from '../schemas/user.schema';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users.manage'), userController.list);
router.post('/', requirePermission('users.manage'), validateBody(createUserSchema), userController.create);
router.patch('/:id/deactivate', requirePermission('users.manage'), userController.deactivate);
router.patch('/:id/activate', requirePermission('users.manage'), userController.activate);

export default router;

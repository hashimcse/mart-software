import { Router } from 'express';
import * as unitController from '../controllers/unit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createUnitSchema } from '../schemas/unit.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('products.view'), unitController.list);
router.post('/', requirePermission('products.edit'), validateBody(createUnitSchema), unitController.create);

export default router;

import { Router } from 'express';
import * as brandController from '../controllers/brand.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createBrandSchema, updateBrandSchema } from '../schemas/brand.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('products.view'), brandController.list);
router.post('/', requirePermission('products.edit'), validateBody(createBrandSchema), brandController.create);
router.patch('/:id', requirePermission('products.edit'), validateBody(updateBrandSchema), brandController.update);
router.delete('/:id', requirePermission('products.edit'), brandController.remove);

export default router;

import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('products.view'), categoryController.list);
router.post('/', requirePermission('products.edit'), validateBody(createCategorySchema), categoryController.create);
router.patch('/:id', requirePermission('products.edit'), validateBody(updateCategorySchema), categoryController.update);
router.delete('/:id', requirePermission('products.edit'), categoryController.remove);

export default router;

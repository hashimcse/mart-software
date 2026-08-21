import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createProductSchema, updateProductSchema, updateProductStatusSchema } from '../schemas/product.schema';
import { uploadProductImage } from '../middleware/upload.middleware';

const router = Router();
router.use(authenticate);

// /barcode/:barcode must be registered before /:id, or Express would match
// "barcode" itself as an :id.
router.get('/barcode/:barcode', requirePermission('products.view'), productController.getByBarcode);
router.get('/', requirePermission('products.view'), productController.list);
router.get('/:id', requirePermission('products.view'), productController.getOne);
router.post('/', requirePermission('products.edit'), validateBody(createProductSchema), productController.create);
router.patch('/:id', requirePermission('products.edit'), validateBody(updateProductSchema), productController.update);
router.patch(
  '/:id/status',
  requirePermission('products.edit'),
  validateBody(updateProductStatusSchema),
  productController.setStatus,
);
router.post('/:id/image', requirePermission('products.edit'), uploadProductImage, productController.uploadImage);

export default router;

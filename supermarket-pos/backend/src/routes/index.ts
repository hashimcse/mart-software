import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import brandRoutes from './brand.routes';
import unitRoutes from './unit.routes';
import productRoutes from './product.routes';
import saleRoutes from './sale.routes';
import heldBillRoutes from './heldBill.routes';
import customerRoutes from './customer.routes';
import terminalRoutes from './terminal.routes';
import settingsRoutes from './settings.routes';
import inventoryRoutes from './inventory.routes';
import dashboardRoutes from './dashboard.routes';
import supplierRoutes from './supplier.routes';
import purchaseRoutes from './purchase.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/units', unitRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);
router.use('/held-bills', heldBillRoutes);
router.use('/customers', customerRoutes);
router.use('/terminals', terminalRoutes);
router.use('/settings', settingsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchases', purchaseRoutes);

export default router;

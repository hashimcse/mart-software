import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Open to any authenticated user — basic today's-sales/low-stock counts,
// not detailed data, so every role that can log in can see them.
router.get('/summary', dashboardController.summary);

export default router;

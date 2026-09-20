import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createExpenseSchema } from '../schemas/expense.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('expenses.manage'), expenseController.list);
router.post('/', requirePermission('expenses.manage'), validateBody(createExpenseSchema), expenseController.create);

export default router;

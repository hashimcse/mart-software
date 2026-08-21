import { Router } from 'express';
import * as terminalController from '../controllers/terminal.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', terminalController.list);

export default router;

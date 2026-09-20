import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema, refreshSchema } from '../schemas/auth.schema';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' } },
});

router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}), validateBody(refreshSchema), authController.refresh);
router.post('/logout', validateBody(refreshSchema), authController.logout);
router.get('/me', authenticate, authController.me);

export default router;

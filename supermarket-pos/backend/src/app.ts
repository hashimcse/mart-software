import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import routes from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { NotFoundError } from './utils/errors';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/api', routes);

  app.use((_req, _res, next) => next(new NotFoundError('Route not found')));
  app.use(errorMiddleware);

  return app;
}

import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack, path: req.path });
    }
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
  });

  return res.status(500).json({
    error: { message: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
  });
}

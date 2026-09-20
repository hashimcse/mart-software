import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({error:{message:err.issues.map(i=>i.message).join('; '),code:'VALIDATION_ERROR'}});
  if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2025','P2034'].includes(err.code)) return res.status(409).json({error:{message:'This record changed or conflicts with another record. Refresh and try again.',code:'CONFLICT'}});
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({error:{message:'Invalid JSON',code:'INVALID_JSON'}});
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

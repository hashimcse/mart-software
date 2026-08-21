import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Requires the authenticated user to hold ALL of the given permission keys.
 * Must run after `authenticate`.
 */
export function requirePermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const missing = keys.filter((key) => !req.user!.permissions.includes(key));
    if (missing.length > 0) {
      return next(new ForbiddenError(`Missing required permission(s): ${missing.join(', ')}`));
    }

    return next();
  };
}

/**
 * Requires the authenticated user to hold AT LEAST ONE of the given
 * permission keys — for endpoints multiple roles legitimately need read
 * access to (e.g. inventory alerts are useful to both inventory.manage
 * and reports.view holders) without granting either permission to the other.
 */
export function requireAnyPermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const hasAny = keys.some((key) => req.user!.permissions.includes(key));
    if (!hasAny) {
      return next(new ForbiddenError(`Missing one of the required permissions: ${keys.join(', ')}`));
    }

    return next();
  };
}

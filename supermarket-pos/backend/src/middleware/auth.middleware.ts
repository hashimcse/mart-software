import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length);

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new UnauthorizedError('Invalid or expired access token'));
  }
}

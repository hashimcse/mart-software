import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
  role: string;
  permissions: string[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // env.accessTokenTtl is a plain string (e.g. "15m") sourced from an env
  // var; @types/jsonwebtoken wants its branded ms.StringValue type at
  // compile time, but any valid "ms"-style string works at runtime.
  const options: jwt.SignOptions = { expiresIn: env.accessTokenTtl as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.accessTokenSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.accessTokenSecret) as AccessTokenPayload;
}

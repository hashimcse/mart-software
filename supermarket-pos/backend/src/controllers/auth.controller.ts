import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import { UnauthorizedError } from '../utils/errors';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await authService.login(username, password, req.ip);
  res.json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshSession(refreshToken);
  res.json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await authService.getCurrentUser(req.user.sub);
  res.json(user);
});

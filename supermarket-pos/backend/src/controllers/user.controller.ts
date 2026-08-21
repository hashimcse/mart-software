import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as userService from '../services/user.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.listUsers();
  res.json(users);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await userService.createUser(req.body, req.user.sub);
  res.status(201).json(user);
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const updated = await userService.setUserActive(req.params.id, false, req.user.sub);
  res.json(updated);
});

export const activate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const updated = await userService.setUserActive(req.params.id, true, req.user.sub);
  res.json(updated);
});

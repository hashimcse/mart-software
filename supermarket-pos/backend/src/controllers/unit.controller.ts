import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as unitService from '../services/unit.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await unitService.listUnits());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const unit = await unitService.createUnit(req.body, req.user.sub);
  res.status(201).json(unit);
});

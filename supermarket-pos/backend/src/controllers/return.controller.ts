import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as returnService from '../services/return.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await returnService.listReturns(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await returnService.getReturnById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const created = await returnService.createReturn(req.body, req.user.sub);
  res.status(201).json(created);
});

export const returnableForSale = asyncHandler(async (req: Request, res: Response) => {
  res.json(await returnService.getReturnableLines(req.params.saleId));
});

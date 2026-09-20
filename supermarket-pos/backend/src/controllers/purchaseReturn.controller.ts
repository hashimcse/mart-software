import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as purchaseReturnService from '../services/purchaseReturn.service';
import { UnauthorizedError } from '../utils/errors';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const created = await purchaseReturnService.createPurchaseReturn({ ...req.body, purchaseId: req.params.id }, req.user.sub);
  res.status(201).json(created);
});

export const returnableForPurchase = asyncHandler(async (req: Request, res: Response) => {
  res.json(await purchaseReturnService.getPurchaseReturnableLines(req.params.purchaseId));
});

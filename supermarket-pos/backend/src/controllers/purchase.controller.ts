import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as purchaseService from '../services/purchase.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await purchaseService.listPurchases(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await purchaseService.getPurchaseById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const purchase = await purchaseService.createPurchase(req.body, req.user.sub);
  res.status(201).json(purchase);
});

export const receive = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await purchaseService.receivePurchase(req.params.id, req.user.sub));
});

export const invoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await purchaseService.markInvoiced(req.params.id, req.user.sub));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await purchaseService.cancelPurchase(req.params.id, req.user.sub));
});

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as inventoryService from '../services/inventory.service';
import { UnauthorizedError } from '../utils/errors';

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { productId, quantityChange, reason } = req.body;
  const movement = await inventoryService.recordAdjustment(productId, quantityChange, reason, req.user.sub);
  res.status(201).json(movement);
});

export const markDamaged = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { productId, quantity, reason } = req.body;
  const movement = await inventoryService.recordDamaged(productId, quantity, reason, req.user.sub);
  res.status(201).json(movement);
});

export const markExpired = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { productId, quantity, reason } = req.body;
  const movement = await inventoryService.recordExpired(productId, quantity, reason, req.user.sub);
  res.status(201).json(movement);
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.listMovements(req.query as Record<string, string>));
});

export const lowStock = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await inventoryService.getLowStockProducts());
});

export const outOfStock = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await inventoryService.getOutOfStockProducts());
});

export const expiring = asyncHandler(async (req: Request, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : 14;
  res.json(await inventoryService.getExpiringProducts(Number.isFinite(days) ? days : 14));
});

export const valuation = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await inventoryService.getValuation());
});

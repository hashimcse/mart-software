import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as saleService from '../services/sale.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await saleService.listSales(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await saleService.getSaleById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await saleService.createSale(req.body, req.user.sub, req.user.permissions);
  res.status(201).json(result);
});

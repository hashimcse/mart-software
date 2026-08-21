import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as supplierService from '../services/supplier.service';
import * as purchaseService from '../services/purchase.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await supplierService.listSuppliers(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await supplierService.getSupplierById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const supplier = await supplierService.createSupplier(req.body, req.user.sub);
  res.status(201).json(supplier);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const supplier = await supplierService.updateSupplier(req.params.id, req.body, req.user.sub);
  res.json(supplier);
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const payment = await purchaseService.recordSupplierPayment(req.params.id, req.body, req.user.sub);
  res.status(201).json(payment);
});

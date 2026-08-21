import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as customerService from '../services/customer.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await customerService.listCustomers(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await customerService.getCustomerById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const customer = await customerService.createCustomer(req.body, req.user.sub);
  res.status(201).json(customer);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await customerService.updateCustomer(req.params.id, req.body, req.user.sub));
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const payment = await customerService.recordCustomerPayment(req.params.id, req.body, req.user.sub);
  res.status(201).json(payment);
});

export const adjustLoyalty = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { pointsChange, reason } = req.body;
  const customer = await customerService.adjustLoyaltyPoints(req.params.id, pointsChange, reason, req.user.sub);
  res.json(customer);
});

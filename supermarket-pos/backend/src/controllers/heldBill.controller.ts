import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as heldBillService from '../services/heldBill.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await heldBillService.listHeldBills(req.query.terminalId as string | undefined));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.status(201).json(await heldBillService.holdBill(req.body, req.user.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await heldBillService.resumeBill(req.params.id));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await heldBillService.deleteHeldBill(req.params.id);
  res.status(204).send();
});

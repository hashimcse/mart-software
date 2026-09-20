import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as expenseService from '../services/expense.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await expenseService.listExpenses(req.query as Record<string, string>));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const expense = await expenseService.createExpense(req.body, req.user.sub);
  res.status(201).json(expense);
});

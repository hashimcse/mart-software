import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as categoryService from '../services/category.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await categoryService.listCategories());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const category = await categoryService.createCategory(req.body, req.user.sub);
  res.status(201).json(category);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const category = await categoryService.updateCategory(req.params.id, req.body, req.user.sub);
  res.json(category);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await categoryService.deleteCategory(req.params.id, req.user.sub);
  res.status(204).send();
});

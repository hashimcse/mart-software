import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as brandService from '../services/brand.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await brandService.listBrands());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const brand = await brandService.createBrand(req.body.name, req.user.sub);
  res.status(201).json(brand);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const brand = await brandService.updateBrand(req.params.id, req.body.name, req.user.sub);
  res.json(brand);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await brandService.deleteBrand(req.params.id, req.user.sub);
  res.status(204).send();
});

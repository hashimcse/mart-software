import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as productService from '../services/product.service';
import { UnauthorizedError, ValidationError } from '../utils/errors';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await productService.listProducts(req.query as Record<string, string>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await productService.getProductById(req.params.id));
});

export const getByBarcode = asyncHandler(async (req: Request, res: Response) => {
  res.json(await productService.getProductByBarcode(req.params.barcode));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const product = await productService.createProduct(req.body, req.user.sub);
  res.status(201).json(product);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const canEditPrice = req.user.permissions.includes('products.price.edit');
  const product = await productService.updateProduct(req.params.id, req.body, req.user.sub, canEditPrice);
  res.json(product);
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const product = await productService.setProductStatus(req.params.id, req.body.status, req.user.sub);
  res.json(product);
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  if (!req.file) throw new ValidationError('No image file was uploaded');
  const imageUrl = `/uploads/${req.file.filename}`;
  const product = await productService.setProductImage(req.params.id, imageUrl, req.user.sub);
  res.json(product);
});

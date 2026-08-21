import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as settingsService from '../services/settings.service';
import * as printerService from '../services/printer.service';
import { UnauthorizedError } from '../utils/errors';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await settingsService.getSettings());
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const updated = await settingsService.updateSetting(req.params.key, req.body.value, req.user.sub);
  res.json(updated);
});

export const testPrint = asyncHandler(async (_req: Request, res: Response) => {
  await printerService.printTestPageOverNetwork();
  res.json({ status: 'sent' });
});

import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as terminalService from '../services/terminal.service';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await terminalService.listActiveTerminals());
});

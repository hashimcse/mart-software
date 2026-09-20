import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as cashSessionService from '../services/cashSession.service';
import { UnauthorizedError } from '../utils/errors';

export const getOpen = asyncHandler(async (req: Request, res: Response) => {
  const session = await cashSessionService.getOpenSession(req.query.terminalId as string);
  res.json(session);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await cashSessionService.getSessionById(req.params.id));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await cashSessionService.listSessions(req.query as Record<string, string>));
});

export const open = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { terminalId, openingCash } = req.body;
  const session = await cashSessionService.openSession(terminalId, openingCash, req.user.sub);
  res.status(201).json(session);
});

export const addMovement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { type, amount, notes } = req.body;
  const movement = await cashSessionService.addCashMovement(req.params.id, type, amount, notes, req.user.sub);
  res.status(201).json(movement);
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { actualCash } = req.body;
  const session = await cashSessionService.closeSession(req.params.id, actualCash, req.user.sub);
  res.json(session);
});

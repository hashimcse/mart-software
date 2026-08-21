import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { buildReceiptBytes } from '../services/receipt.service';
import { printReceiptOverNetwork } from '../services/printer.service';

export const downloadEscPos = asyncHandler(async (req: Request, res: Response) => {
  const bytes = await buildReceiptBytes(req.params.id);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${req.params.id}.escpos"`);
  res.send(bytes);
});

export const printNetwork = asyncHandler(async (req: Request, res: Response) => {
  await printReceiptOverNetwork(req.params.id);
  res.json({ status: 'sent' });
});

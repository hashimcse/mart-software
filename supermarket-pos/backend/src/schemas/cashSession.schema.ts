import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const openSessionSchema = z.object({
  terminalId: z.string().uuid(),
  openingCash: moneyString,
});

export const cashMovementSchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: moneyString,
  notes: z.string().optional(),
});

export const closeSessionSchema = z.object({
  actualCash: moneyString,
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

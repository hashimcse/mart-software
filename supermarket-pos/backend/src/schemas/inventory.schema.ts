import { z } from 'zod';

const quantityString = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5');
const signedQuantityString = z.string().regex(/^-?\d+(\.\d{1,3})?$/, 'Enter a quantity like 10 or -5');

export const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantityChange: signedQuantityString,
  reason: z.string().min(1, 'A reason is required for stock adjustments'),
});

export const stockRemovalSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantityString,
  reason: z.string().optional(),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type StockRemovalInput = z.infer<typeof stockRemovalSchema>;

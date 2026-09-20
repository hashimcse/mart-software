import { z } from 'zod';

const quantityString = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5');

export const returnItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: quantityString,
  restock: z.boolean().optional().default(true),
});

export const createReturnSchema = z.object({
  saleId: z.string().uuid(),
  items: z.array(returnItemSchema).min(1, 'Select at least one item to return'),
  reason: z.string().optional(),
  refundMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']).optional().default('CASH'),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;

export const purchaseReturnItemSchema = z.object({
  purchaseItemId: z.string().uuid(),
  quantity: quantityString,
});

export const createPurchaseReturnSchema = z.object({
  purchaseId: z.string().uuid(),
  items: z.array(purchaseReturnItemSchema).min(1, 'Select at least one item to return'),
  reason: z.string().optional(),
});

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

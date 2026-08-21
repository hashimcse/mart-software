import { z } from 'zod';

const quantityString = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5');
const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantityString,
  unitCost: moneyString,
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  items: z.array(purchaseItemSchema).min(1, 'Add at least one item'),
  taxAmount: moneyString.optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

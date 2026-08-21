import { z } from 'zod';

const quantityString = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5');
const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantityString,
  discount: moneyString.optional(),
});

export const createSaleSchema = z.object({
  terminalId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'Add at least one item'),
  discountAmount: moneyString.optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']),
        amount: moneyString,
      }),
    )
    .min(1, 'Add at least one payment'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

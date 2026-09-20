import { z } from 'zod';

const quantityString = z.string().max(13).regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5').refine(v=>/[1-9]/.test(v),'Quantity must be positive');
const moneyString = z.string().max(15).regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantityString,
  discount: moneyString.optional(),
});

export const createSaleSchema = z.object({
  terminalId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'Add at least one item').max(200),
  discountAmount: moneyString.optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']),
        amount: moneyString,
      }),
    )
    .min(1, 'Add at least one payment').max(10),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

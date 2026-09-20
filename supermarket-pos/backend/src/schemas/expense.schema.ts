import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const createExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  amount: moneyString,
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']),
  cashSessionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

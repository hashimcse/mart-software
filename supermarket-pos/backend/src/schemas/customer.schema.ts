import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  type: z.enum(['WALK_IN', 'REGISTERED', 'CREDIT']).optional(),
  creditLimit: moneyString.optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerPaymentSchema = z.object({
  amount: moneyString,
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']),
  notes: z.string().optional(),
});

export const loyaltyAdjustmentSchema = z.object({
  pointsChange: z.number().int().refine((n) => n !== 0, 'Points change cannot be zero'),
  reason: z.string().min(1, 'A reason is required'),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;
export type LoyaltyAdjustmentInput = z.infer<typeof loyaltyAdjustmentSchema>;

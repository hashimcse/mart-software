import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  openingBalance: moneyString.optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierPaymentSchema = z.object({
  amount: moneyString,
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT']),
  purchaseId: z.string().uuid().optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;

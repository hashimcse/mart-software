import { z } from 'zod';

export const holdBillSchema = z.object({
  terminalId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  // Opaque cart snapshot — the POS UI owns this shape and reconstructs
  // the cart from it on resume. Prices/stock are re-validated against
  // live data only when the bill is actually completed, not on resume.
  cartData: z.unknown(),
  note: z.string().optional(),
});

export type HoldBillInput = z.infer<typeof holdBillSchema>;

import { z } from 'zod';

// Money and quantities are validated (and stored) as strings, never parsed
// through JS `number`, so they go straight into Prisma's Decimal columns
// without a floating-point round trip anywhere in the request path —
// spec section 29's "no floating point for money" applies to the API
// boundary too, not just the database.
const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 12.99');
const quantityString = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Enter a quantity like 1 or 0.5');

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid('Select a unit'),
  purchasePrice: moneyString,
  sellingPrice: moneyString,
  wholesalePrice: moneyString.optional(),
  taxId: z.string().uuid().optional().nullable(),
  discountId: z.string().uuid().optional().nullable(),
  currentStock: quantityString.optional(),
  minStock: quantityString.optional(),
  maxStock: quantityString.optional(),
  isWeighted: z.boolean().optional().default(false),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const updateProductStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
});

// Fields gated behind the separate `products.price.edit` permission
// (spec section 16: "changing prices" is its own permission, distinct
// from editing a product's other fields).
export const PRICE_FIELDS = ['purchasePrice', 'sellingPrice', 'wholesalePrice'] as const;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

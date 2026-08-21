import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parentId: z.string().uuid().optional().nullable(),
  taxId: z.string().uuid().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

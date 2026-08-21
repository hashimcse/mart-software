import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateBrandSchema = createBrandSchema;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

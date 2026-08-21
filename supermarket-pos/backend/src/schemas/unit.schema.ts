import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().min(1).max(10, 'Keep the abbreviation short'),
  isFractional: z.boolean().optional().default(false),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

import { z } from 'zod';

export const updateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  email: z.string().email().optional(),
  password: z.string().min(12, 'Password must be at least 12 characters').max(72),
  roleName: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

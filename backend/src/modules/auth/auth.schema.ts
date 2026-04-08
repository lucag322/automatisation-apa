import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['admin', 'editor']).default('editor'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

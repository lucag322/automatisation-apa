import { z } from 'zod';

export const createContextSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  active: z.boolean().optional().default(true),
});

export const updateContextSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type CreateContextInput = z.infer<typeof createContextSchema>;
export type UpdateContextInput = z.infer<typeof updateContextSchema>;

import { z } from 'zod';

export const researchQuerySchema = z.object({
  topic: z.string().optional(),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;

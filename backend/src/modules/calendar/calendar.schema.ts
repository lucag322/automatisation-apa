import { z } from 'zod';

export const calendarQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discover: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional().default(false),
});

export const generateEventPostSchema = z.object({
  name: z.string().min(1),
  date: z.string(),
  fullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  themes: z.array(z.string()).min(1),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type GenerateEventPostInput = z.infer<typeof generateEventPostSchema>;

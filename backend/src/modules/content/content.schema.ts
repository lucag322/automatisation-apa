import { z } from 'zod';

export const contentFiltersSchema = z.object({
  status: z.string().optional(),
  theme: z.string().optional(),
  postType: z.string().optional(),
  sourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'score', 'review_first']).optional().default('newest'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export type ContentFilters = z.infer<typeof contentFiltersSchema>;

export const updateContentSchema = z.object({
  title: z.string().optional(),
  hook: z.string().optional(),
  body: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  cta: z.string().optional(),
  postType: z.string().optional(),
  theme: z.string().optional(),
  persona: z.string().optional(),
  targetPublishDate: z.string().nullable().optional(),
  priorityScore: z.number().optional(),
});

export type UpdateContentInput = z.infer<typeof updateContentSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'to_review', 'approved', 'rejected', 'published']),
  comment: z.string().optional(),
});

export const regenerateSchema = z.object({
  angle: z.string().optional(),
  instructions: z.string().optional(),
});

import { z } from 'zod';

export const manualGenerateSchema = z.object({
  prompt: z.string().min(3),
  url: z.string().url().optional(),
});

export const refineSchema = z.object({
  title: z.string(),
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()),
  instructions: z.string().min(1),
});

export const saveGeneratedSchema = z.object({
  title: z.string().min(1),
  hook: z.string(),
  body: z.string().min(1),
  cta: z.string(),
  hashtags: z.array(z.string()),
  theme: z.string(),
  postType: z.string(),
  sourceUrl: z.string().optional(),
  sourceTitle: z.string().optional(),
  rawContent: z.string().optional(),
});

export type ManualGenerateInput = z.infer<typeof manualGenerateSchema>;
export type RefineInput = z.infer<typeof refineSchema>;
export type SaveGeneratedInput = z.infer<typeof saveGeneratedSchema>;

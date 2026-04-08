import { z } from 'zod';

export const sourceFiltersSchema = z.object({
  sourceType: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export const ingestSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  content: z.string().min(10),
  published_at: z.string().optional(),
  source_type: z.string().optional(),
});

export const scrapeAndIngestSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  source_type: z.string().optional(),
});

export type IngestInput = z.infer<typeof ingestSchema>;
export type ScrapeAndIngestInput = z.infer<typeof scrapeAndIngestSchema>;

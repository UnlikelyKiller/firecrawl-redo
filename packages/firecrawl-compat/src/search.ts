import { z } from 'zod';
import { ScrapeRequestSchema } from './scrape';

export const SearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  lang: z.string().optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  timeoutMs: z.number().optional(),
  scrapeOptions: ScrapeRequestSchema.omit({ url: true }).optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.record(z.string(), z.any())).optional(),
  error: z.string().optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

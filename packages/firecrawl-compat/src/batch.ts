import { z } from 'zod';
import { ScrapeRequestSchema } from './scrape';

export const BatchScrapeRequestSchema = z.object({
  urls: z.array(z.string().url()),
  scrapeOptions: ScrapeRequestSchema.omit({ url: true }).optional(),
});

export type BatchScrapeRequest = z.infer<typeof BatchScrapeRequestSchema>;

export const BatchScrapeResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
});

export type BatchScrapeResponse = z.infer<typeof BatchScrapeResponseSchema>;

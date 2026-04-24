import { z } from 'zod';
import { ScrapeRequestSchema } from './scrape';

export const CrawlRequestSchema = z.object({
  url: z.string().url(),
  excludePaths: z.array(z.string()).optional(),
  includePaths: z.array(z.string()).optional(),
  maxDepth: z.number().optional(),
  limit: z.number().optional(),
  sitemapOnly: z.boolean().optional(),
  ignoreCache: z.boolean().optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
  scrapeOptions: ScrapeRequestSchema.omit({ url: true }).optional(),
  timeoutMs: z.number().optional(),
});

export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export const CrawlResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

export type CrawlResponse = z.infer<typeof CrawlResponseSchema>;

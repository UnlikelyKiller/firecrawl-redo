import { z } from 'zod';

export const ScrapeRequestSchema = z.object({
  url: z.string().url(),
  formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'screenshot', 'links', 'extract'])).optional(),
  onlyMainContent: z.boolean().optional(),
  includeRawHtml: z.boolean().optional(),
  timeout: z.number().optional(),
  timeoutMs: z.number().optional(),
  ignoreCache: z.boolean().optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
  // Add other v2 fields as needed
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

export const ScrapeResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string().optional(),
    markdown: z.string().optional(),
    html: z.string().optional(),
    rawHtml: z.string().optional(),
    screenshot: z.string().optional(),
    links: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    extract: z.record(z.string(), z.any()).optional(),
  }).optional(),
  error: z.string().optional(),
});

export type ScrapeResponse = z.infer<typeof ScrapeResponseSchema>;

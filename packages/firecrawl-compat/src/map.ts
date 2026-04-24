import { z } from 'zod';

export const MapRequestSchema = z.object({
  url: z.string().url(),
  search: z.string().optional(),
  ignoreSitemap: z.boolean().optional(),
  sitemapOnly: z.boolean().optional(),
  includeOmnicrawl: z.boolean().optional(),
  limit: z.number().optional(),
  timeoutMs: z.number().optional(),
  ignoreCache: z.boolean().optional(),
});

export type MapRequest = z.infer<typeof MapRequestSchema>;

export const MapResponseSchema = z.object({
  success: z.boolean(),
  links: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type MapResponse = z.infer<typeof MapResponseSchema>;

import { z } from 'zod';

export const ExtractRequestSchema = z.object({
  urls: z.array(z.string().url()),
  prompt: z.string().optional(),
  schema: z.any().optional(), // Can be a Zod schema object or JSON schema
  systemPrompt: z.string().optional(),
  allowExternalLinks: z.boolean().optional(),
  maxRepairAttempts: z.number().optional().default(2),
  model: z.string().optional(),
});

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const ExtractResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    url: z.string(),
    content: z.record(z.string(), z.any()).optional(),
    confidence: z.number().optional(),
    error: z.string().optional(),
  })),
  error: z.string().optional(),
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

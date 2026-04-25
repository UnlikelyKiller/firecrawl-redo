import { z } from 'zod';

export const AgentRequestSchema = z.object({
  prompt: z.string(),
  maxPages: z.number().optional().default(5),
  schema: z.any().optional(),
  model: z.string().optional(),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string().uuid(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

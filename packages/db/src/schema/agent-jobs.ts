import { pgTable, uuid, text, integer, jsonb } from 'drizzle-orm/pg-core';
import { crawlJobs } from './jobs';

export const agentJobs = pgTable('agent_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => crawlJobs.id).notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull(),
  steps: jsonb('steps').default([]),
});

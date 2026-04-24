import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { crawlJobs } from './jobs';

export const engineAttempts = pgTable('engine_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => crawlJobs.id).notNull(),
  engineName: text('engine_name').notNull(),
  status: text('status').notNull(),
  error: text('error'), // Detailed error message or classification
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').defaultNow(),
});

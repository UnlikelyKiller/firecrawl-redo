import { pgTable, uuid, text, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';

export const manualReviews = pgTable('manual_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id'),
  url: text('url').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, completed, rejected
  reason: text('reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

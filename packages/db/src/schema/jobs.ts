import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const crawlJobs = pgTable('crawl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

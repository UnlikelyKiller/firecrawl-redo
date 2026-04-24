import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const crawlJobs = pgTable('crawl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // SCRAPE, CRAWL, etc.
  url: text('url').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

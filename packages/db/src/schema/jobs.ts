import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const crawlJobs = pgTable('crawl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // SCRAPE, CRAWL, etc.
  url: text('url').notNull(),
  status: text('status').notNull(), // QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
  error: text('error'),
  payload: jsonb('payload').notNull(), // Request payload/config
  mode: text('mode'), // static, js, playwright
  config: jsonb('config'), // specific engine config
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

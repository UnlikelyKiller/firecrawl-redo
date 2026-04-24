import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const watchJobs = pgTable('watch_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  interval: text('interval').notNull(),
  lastRunAt: timestamp('last_run_at'),
});

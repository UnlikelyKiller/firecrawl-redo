import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const watchJobs = pgTable('watch_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  interval: text('interval').notNull(),
  active: boolean("active").default(true).notNull(),
  lastRunAt: timestamp('last_run_at'),
  lastCheckAt: timestamp("last_check_at"),
  nextCheckAt: timestamp("next_check_at"),
  schema: jsonb("schema"),
  webhook: text("webhook"),
});

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const pageSnapshots = pgTable('page_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

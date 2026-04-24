import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  events: text('events').array().notNull(),
  secret: text('secret').notNull(),
});

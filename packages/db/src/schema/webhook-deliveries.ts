import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { webhookSubscriptions } from './webhook-subscriptions';

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').references(() => webhookSubscriptions.id).notNull(),
  status: integer('status').notNull(),
  attemptAt: timestamp('attempt_at').defaultNow(),
});

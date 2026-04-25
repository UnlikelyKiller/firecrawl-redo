import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { browserProfiles } from './browser-profiles';
import { crawlJobs } from './jobs';

export const browserProfileLeases = pgTable('browser_profile_leases', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => browserProfiles.id),
  ownerJobId: uuid('owner_job_id').references(() => crawlJobs.id),
  workerId: text('worker_id').notNull(),
  status: text('status').notNull().default('active'),
  expiresAt: timestamp('expires_at').notNull(),
  lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow().notNull(),
  cooldownUntil: timestamp('cooldown_until'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

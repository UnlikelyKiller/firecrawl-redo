import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { browserProfiles } from './browser-profiles';
import { crawlJobs } from './jobs';

export const browserProfileLeases = pgTable(
  'browser_profile_leases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => browserProfiles.id),
    ownerJobId: uuid('owner_job_id').references(() => crawlJobs.id),
    workerId: text('worker_id').notNull(),
    // owner_type: worker | agent | operator
    ownerType: text('owner_type').notNull().default('worker'),
    // Stable reference ID for the owning entity (worker hostname, agent ID, operator ID)
    ownerId: text('owner_id'),
    // Idempotent release token — caller must present this to release
    leaseToken: text('lease_token').notNull().default(''),
    // active | expired | released | orphaned
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at').notNull(),
    lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow().notNull(),
    releasedAt: timestamp('released_at'),
    releaseReason: text('release_reason'),
    cooldownUntil: timestamp('cooldown_until'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Only one active lease per profile is permitted at the DB level
    uniqueIndex('one_active_lease_per_profile')
      .on(table.profileId)
      .where(sql`${table.status} = 'active'`),
  ],
);

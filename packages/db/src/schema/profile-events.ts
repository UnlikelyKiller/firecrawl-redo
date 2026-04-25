import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { browserProfiles } from './browser-profiles';
import { crawlJobs } from './jobs';

export const profileEvents = pgTable('profile_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => browserProfiles.id),
  jobId: uuid('job_id').references(() => crawlJobs.id),
  // Event types:
  // lease_acquired | lease_heartbeat | lease_released | quarantined
  // backend_attach_started | backend_attach_failed
  // proxy_mismatch | operator_handoff | operator_resume
  eventType: text('event_type').notNull(),
  // Freeform structured metadata for the event
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

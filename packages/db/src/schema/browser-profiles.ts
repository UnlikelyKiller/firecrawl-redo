import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const browserProfiles = pgTable('browser_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: text('domain').notNull(),
  backend: text('backend').notNull().default('local_vault'),
  encryptedProfile: text('encrypted_profile'),
  externalProfileId: text('external_profile_id'),
  externalProfileLabel: text('external_profile_label'),
  bridgeTarget: text('bridge_target'),
  automationType: text('automation_type'),
  profileKind: text('profile_kind'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const browserProfiles = pgTable('browser_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: text('domain').notNull(),
  encryptedProfile: text('encrypted_profile').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

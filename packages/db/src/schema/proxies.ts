import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const proxies = pgTable('proxies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: text('provider'),
  proxyUrl: text('proxy_url').notNull(),
  authSecretRef: text('auth_secret_ref'),
  geoCountry: text('geo_country'),
  geoRegion: text('geo_region'),
  timezoneHint: text('timezone_hint'),
  // active | disabled | unhealthy
  status: text('status').notNull().default('active'),
  lastHealthcheckAt: timestamp('last_healthcheck_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

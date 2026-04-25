import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { proxies } from './proxies';

export const browserProfiles = pgTable('browser_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Human-readable name for this profile
  name: text('name'),
  // backend_type: local | tandem | multilogin | custom
  backendType: text('backend_type').notNull().default('local'),
  // Legacy compat — original 'backend' column kept for backward compat
  backend: text('backend').notNull().default('local_vault'),
  encryptedProfile: text('encrypted_profile'),
  externalProfileId: text('external_profile_id'),
  externalProfileLabel: text('external_profile_label'),
  // Tandem session identity (session partition name or workspace reference)
  sessionPartition: text('session_partition'),
  // Hint for which tab/workspace to target on attach
  defaultTabHint: text('default_tab_hint'),
  // Identity metadata
  accountLabel: text('account_label'),
  tenantId: text('tenant_id'),
  // Stable proxy assignment; must not change during an active lease
  proxyId: uuid('proxy_id').references(() => proxies.id),
  locale: text('locale'),
  timezone: text('timezone'),
  userAgentFamily: text('user_agent_family'),
  browserChannel: text('browser_channel'),
  // Lifecycle: active | disabled | quarantined | cooldown
  status: text('status').notNull().default('active'),
  // Backend capability flags stored as JSON
  capabilitiesJson: jsonb('capabilities_json'),
  lastHealthcheckAt: timestamp('last_healthcheck_at'),
  lastUsedAt: timestamp('last_used_at'),
  // Legacy fields from Multilogin era — kept for compat
  bridgeTarget: text('bridge_target'),
  automationType: text('automation_type'),
  profileKind: text('profile_kind'),
  domain: text('domain').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

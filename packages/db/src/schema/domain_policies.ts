import { pgTable, uuid, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

export const domainPolicies = pgTable('domain_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: text('domain').notNull().unique(),
  action: text('action').notNull().default('allow'),
  robotsTxt: text('robots_txt'),
  rateLimit: jsonb('rate_limit'), // { requestsPerSecond: number, windowSeconds: number }
  pathPatterns: jsonb('path_patterns').notNull().default([]), // Array of { pattern: string, action: 'ALLOW' | 'BLOCK' }
  maxDepth: integer('max_depth'),
  browserMode: text('browser_mode').notNull().default('static'),
  sessionBackend: text('session_backend').notNull().default('crawlx_local'),
  requiresNamedProfile: boolean('requires_named_profile').notNull().default(false),
  requiresManualApproval: boolean('requires_manual_approval').notNull().default(false),
  allowCloudEscalation: boolean('allow_cloud_escalation').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

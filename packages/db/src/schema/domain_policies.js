"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.domainPolicies = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.domainPolicies = (0, pg_core_1.pgTable)('domain_policies', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    domain: (0, pg_core_1.text)('domain').notNull().unique(),
    action: (0, pg_core_1.text)('action').notNull().default('allow'),
    robotsTxt: (0, pg_core_1.text)('robots_txt'),
    rateLimit: (0, pg_core_1.jsonb)('rate_limit'), // { requestsPerSecond: number, windowSeconds: number }
    pathPatterns: (0, pg_core_1.jsonb)('path_patterns').notNull().default([]), // Array of { pattern: string, action: 'ALLOW' | 'BLOCK' }
    maxDepth: (0, pg_core_1.integer)('max_depth'),
    browserMode: (0, pg_core_1.text)('browser_mode').notNull().default('static'),
    sessionBackend: (0, pg_core_1.text)('session_backend').notNull().default('crawlx_local'),
    requiresNamedProfile: (0, pg_core_1.boolean)('requires_named_profile').notNull().default(false),
    requiresManualApproval: (0, pg_core_1.boolean)('requires_manual_approval').notNull().default(false),
    allowCloudEscalation: (0, pg_core_1.boolean)('allow_cloud_escalation').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
//# sourceMappingURL=domain_policies.js.map

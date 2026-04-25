"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserProfileLeases = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const browser_profiles_1 = require("./browser-profiles");
const jobs_1 = require("./jobs");
exports.browserProfileLeases = (0, pg_core_1.pgTable)('browser_profile_leases', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    profileId: (0, pg_core_1.uuid)('profile_id')
        .notNull()
        .references(() => browser_profiles_1.browserProfiles.id),
    ownerJobId: (0, pg_core_1.uuid)('owner_job_id').references(() => jobs_1.crawlJobs.id),
    workerId: (0, pg_core_1.text)('worker_id').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('active'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    lastHeartbeatAt: (0, pg_core_1.timestamp)('last_heartbeat_at').defaultNow().notNull(),
    cooldownUntil: (0, pg_core_1.timestamp)('cooldown_until'),
    lastError: (0, pg_core_1.text)('last_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});

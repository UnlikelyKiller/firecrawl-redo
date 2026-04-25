"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engineAttempts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const jobs_1 = require("./jobs");
exports.engineAttempts = (0, pg_core_1.pgTable)('engine_attempts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)('job_id').references(() => jobs_1.crawlJobs.id).notNull(),
    engineName: (0, pg_core_1.text)('engine_name').notNull(),
    status: (0, pg_core_1.text)('status').notNull(),
    error: (0, pg_core_1.text)('error'), // Detailed error message or classification
    latencyMs: (0, pg_core_1.integer)('latency_ms'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
//# sourceMappingURL=engine-attempts.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentJobs = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const jobs_1 = require("./jobs");
exports.agentJobs = (0, pg_core_1.pgTable)('agent_jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)('job_id').references(() => jobs_1.crawlJobs.id).notNull(),
    prompt: (0, pg_core_1.text)('prompt').notNull(),
    status: (0, pg_core_1.text)('status').notNull(),
    steps: (0, pg_core_1.jsonb)('steps').default([]),
});
//# sourceMappingURL=agent-jobs.js.map
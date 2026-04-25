"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchJobs = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.watchJobs = (0, pg_core_1.pgTable)('watch_jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    url: (0, pg_core_1.text)('url').notNull(),
    interval: (0, pg_core_1.text)('interval').notNull(),
    checkInterval: (0, pg_core_1.text)("check_interval"),
    active: (0, pg_core_1.boolean)("active"),
    lastRunAt: (0, pg_core_1.timestamp)('last_run_at'),
    lastCheckAt: (0, pg_core_1.timestamp)("last_check_at"),
    nextCheckAt: (0, pg_core_1.timestamp)("next_check_at"),
});
//# sourceMappingURL=watch-jobs.js.map
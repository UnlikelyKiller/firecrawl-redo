"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlJobs = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.crawlJobs = (0, pg_core_1.pgTable)('crawl_jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    type: (0, pg_core_1.text)('type').notNull(), // SCRAPE, CRAWL, etc.
    url: (0, pg_core_1.text)('url').notNull(),
    status: (0, pg_core_1.text)('status').notNull(),
    error: (0, pg_core_1.text)('error'),
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
//# sourceMappingURL=jobs.js.map
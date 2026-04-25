"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageSnapshots = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.pageSnapshots = (0, pg_core_1.pgTable)("page_snapshots", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)("job_id").notNull(),
    url: (0, pg_core_1.text)("url").notNull(),
    contentHash: (0, pg_core_1.text)("content_hash").notNull(), // SHA-256
    requestUrl: (0, pg_core_1.text)("request_url").notNull(),
    responseUrl: (0, pg_core_1.text)("response_url").notNull(),
    statusCode: (0, pg_core_1.integer)("status_code"),
    contentType: (0, pg_core_1.text)("content_type"),
    contentLength: (0, pg_core_1.integer)("content_length"),
    headers: (0, pg_core_1.jsonb)("headers").$type(),
    metadata: (0, pg_core_1.jsonb)("metadata").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
//# sourceMappingURL=page_snapshots.js.map
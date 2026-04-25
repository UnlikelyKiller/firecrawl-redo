"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLog = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.activityLog = (0, pg_core_1.pgTable)("activity_log", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    entityId: (0, pg_core_1.uuid)("entity_id"),
    entityType: (0, pg_core_1.text)("entity_type").notNull(), // JOB, SYSTEM, USER
    event: (0, pg_core_1.text)("event").notNull(),
    level: (0, pg_core_1.text)("level").notNull(), // INFO, WARN, ERROR
    message: (0, pg_core_1.text)("message").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
//# sourceMappingURL=activity_log.js.map
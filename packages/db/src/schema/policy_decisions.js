"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyDecisions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.policyDecisions = (0, pg_core_1.pgTable)("policy_decisions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)("job_id"),
    url: (0, pg_core_1.text)("url").notNull(),
    action: (0, pg_core_1.text)("action").notNull(), // ALLOW, BLOCK, BYPASS
    reason: (0, pg_core_1.text)("reason").notNull(),
    policyId: (0, pg_core_1.text)("policy_id"),
    metadata: (0, pg_core_1.jsonb)("metadata").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
//# sourceMappingURL=policy_decisions.js.map
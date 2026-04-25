"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmCalls = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.llmCalls = (0, pg_core_1.pgTable)("llm_calls", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)("job_id"),
    provider: (0, pg_core_1.text)("provider").notNull(),
    model: (0, pg_core_1.text)("model").notNull(),
    tokensIn: (0, pg_core_1.integer)("tokens_in"),
    tokensOut: (0, pg_core_1.integer)("tokens_out"),
    latencyMs: (0, pg_core_1.integer)("latency_ms"),
    costEstimateCents: (0, pg_core_1.integer)("cost_estimate_cents"),
    correlationId: (0, pg_core_1.uuid)("correlation_id"),
    status: (0, pg_core_1.text)("status").notNull(), // SUCCESS, FAILURE
    request: (0, pg_core_1.jsonb)("request").notNull(),
    response: (0, pg_core_1.jsonb)("response"),
    error: (0, pg_core_1.text)("error"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
//# sourceMappingURL=llm_calls.js.map
import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  costEstimateCents: integer("cost_estimate_cents"),
  correlationId: uuid("correlation_id"),
  status: text("status").notNull(), // SUCCESS, FAILURE
  request: jsonb("request").notNull(),
  response: jsonb("response"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

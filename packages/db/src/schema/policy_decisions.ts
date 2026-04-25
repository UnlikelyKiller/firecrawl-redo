import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const policyDecisions = pgTable("policy_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  url: text("url").notNull(),
  action: text("action").notNull(), // ALLOW, BLOCK, BYPASS
  reason: text("reason").notNull(),
  policyId: text("policy_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

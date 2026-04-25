import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id"),
  entityType: text("entity_type").notNull(), // JOB, SYSTEM, USER
  event: text("event").notNull(),
  level: text("level").notNull(), // INFO, WARN, ERROR
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";

export const pageSnapshots = pgTable("page_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  url: text("url").notNull(),
  contentHash: text("content_hash").notNull(), // SHA-256
  requestUrl: text("request_url").notNull(),
  responseUrl: text("response_url").notNull(),
  statusCode: integer("status_code"),
  contentType: text("content_type"),
  contentLength: integer("content_length"),
  headers: jsonb("headers").$type<Record<string, string>>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

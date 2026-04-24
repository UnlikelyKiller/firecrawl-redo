import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { crawlJobs } from './jobs';

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => crawlJobs.id),
  canonicalUrl: text('canonical_url').notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  statusCode: integer('status_code'),
  contentType: text('content_type'),
  markdownHash: text('markdown_hash'),        // SHA-256
  rawHtmlHash: text('raw_html_hash'),
  renderedHtmlHash: text('rendered_html_hash'),
  screenshotHash: text('screenshot_hash'),
  videoReceiptHash: text('video_receipt_hash'),
  ariaSnapshotHash: text('aria_snapshot_hash'),
  harHash: text('har_hash'),
  metadataHash: text('metadata_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

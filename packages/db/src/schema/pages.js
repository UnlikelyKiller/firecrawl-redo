"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pages = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const jobs_1 = require("./jobs");
exports.pages = (0, pg_core_1.pgTable)('pages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)('job_id').notNull().references(() => jobs_1.crawlJobs.id),
    canonicalUrl: (0, pg_core_1.text)('canonical_url').notNull(),
    normalizedUrl: (0, pg_core_1.text)('normalized_url').notNull(),
    statusCode: (0, pg_core_1.integer)('status_code'),
    contentType: (0, pg_core_1.text)('content_type'),
    markdownHash: (0, pg_core_1.text)('markdown_hash'), // SHA-256
    rawHtmlHash: (0, pg_core_1.text)('raw_html_hash'),
    renderedHtmlHash: (0, pg_core_1.text)('rendered_html_hash'),
    screenshotHash: (0, pg_core_1.text)('screenshot_hash'),
    videoReceiptHash: (0, pg_core_1.text)('video_receipt_hash'),
    ariaSnapshotHash: (0, pg_core_1.text)('aria_snapshot_hash'),
    harHash: (0, pg_core_1.text)('har_hash'),
    metadataHash: (0, pg_core_1.text)('metadata_hash'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=pages.js.map
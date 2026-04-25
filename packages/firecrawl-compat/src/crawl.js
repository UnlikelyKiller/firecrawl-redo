"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlResponseSchema = exports.CrawlRequestSchema = void 0;
const zod_1 = require("zod");
const scrape_1 = require("./scrape");
exports.CrawlRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    excludePaths: zod_1.z.array(zod_1.z.string()).optional(),
    includePaths: zod_1.z.array(zod_1.z.string()).optional(),
    maxDepth: zod_1.z.number().optional(),
    limit: zod_1.z.number().optional(),
    sitemapOnly: zod_1.z.boolean().optional(),
    ignoreCache: zod_1.z.boolean().optional(),
    customHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    scrapeOptions: scrape_1.ScrapeRequestSchema.omit({ url: true }).optional(),
    timeoutMs: zod_1.z.number().optional(),
});
exports.CrawlResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    id: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=crawl.js.map
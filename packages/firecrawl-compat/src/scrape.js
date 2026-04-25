"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapeResponseSchema = exports.ScrapeRequestSchema = void 0;
const zod_1 = require("zod");
exports.ScrapeRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    formats: zod_1.z.array(zod_1.z.enum(['markdown', 'html', 'rawHtml', 'screenshot', 'links', 'extract'])).optional(),
    onlyMainContent: zod_1.z.boolean().optional(),
    includeRawHtml: zod_1.z.boolean().optional(),
    timeout: zod_1.z.number().optional(),
    timeoutMs: zod_1.z.number().optional(),
    ignoreCache: zod_1.z.boolean().optional(),
    customHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    // Add other v2 fields as needed
});
exports.ScrapeResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.object({
        content: zod_1.z.string().optional(),
        markdown: zod_1.z.string().optional(),
        html: zod_1.z.string().optional(),
        rawHtml: zod_1.z.string().optional(),
        screenshot: zod_1.z.string().optional(),
        links: zod_1.z.array(zod_1.z.string()).optional(),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        extract: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    }).optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=scrape.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchScrapeResponseSchema = exports.BatchScrapeRequestSchema = void 0;
const zod_1 = require("zod");
const scrape_1 = require("./scrape");
exports.BatchScrapeRequestSchema = zod_1.z.object({
    urls: zod_1.z.array(zod_1.z.string().url()),
    scrapeOptions: scrape_1.ScrapeRequestSchema.omit({ url: true }).optional(),
});
exports.BatchScrapeResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    id: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=batch.js.map
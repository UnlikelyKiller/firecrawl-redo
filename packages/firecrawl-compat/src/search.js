"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResponseSchema = exports.SearchRequestSchema = void 0;
const zod_1 = require("zod");
const scrape_1 = require("./scrape");
exports.SearchRequestSchema = zod_1.z.object({
    query: zod_1.z.string(),
    limit: zod_1.z.number().optional(),
    lang: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    timeoutMs: zod_1.z.number().optional(),
    scrapeOptions: scrape_1.ScrapeRequestSchema.omit({ url: true }).optional(),
});
exports.SearchResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.any())).optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=search.js.map
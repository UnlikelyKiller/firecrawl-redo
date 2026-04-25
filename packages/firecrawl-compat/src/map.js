"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapResponseSchema = exports.MapRequestSchema = void 0;
const zod_1 = require("zod");
exports.MapRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    search: zod_1.z.string().optional(),
    ignoreSitemap: zod_1.z.boolean().optional(),
    sitemapOnly: zod_1.z.boolean().optional(),
    includeOmnicrawl: zod_1.z.boolean().optional(),
    limit: zod_1.z.number().optional(),
    timeoutMs: zod_1.z.number().optional(),
    ignoreCache: zod_1.z.boolean().optional(),
});
exports.MapResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    links: zod_1.z.array(zod_1.z.string()).optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=map.js.map
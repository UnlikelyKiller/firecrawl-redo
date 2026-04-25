"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractResponseSchema = exports.ExtractRequestSchema = void 0;
const zod_1 = require("zod");
exports.ExtractRequestSchema = zod_1.z.object({
    urls: zod_1.z.array(zod_1.z.string().url()),
    prompt: zod_1.z.string().optional(),
    schema: zod_1.z.any().optional(), // Can be a Zod schema object or JSON schema
    systemPrompt: zod_1.z.string().optional(),
    allowExternalLinks: zod_1.z.boolean().optional(),
    maxRepairAttempts: zod_1.z.number().optional().default(2),
    model: zod_1.z.string().optional(),
});
exports.ExtractResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.array(zod_1.z.object({
        url: zod_1.z.string(),
        content: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        confidence: zod_1.z.number().optional(),
        error: zod_1.z.string().optional(),
    })),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=extract.js.map
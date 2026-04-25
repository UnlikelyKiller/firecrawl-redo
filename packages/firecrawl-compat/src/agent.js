"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentResponseSchema = exports.AgentRequestSchema = void 0;
const zod_1 = require("zod");
exports.AgentRequestSchema = zod_1.z.object({
    prompt: zod_1.z.string(),
    maxPages: zod_1.z.number().optional().default(5),
    schema: zod_1.z.any().optional(),
    model: zod_1.z.string().optional(),
});
exports.AgentResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    jobId: zod_1.z.string().uuid(),
    data: zod_1.z.any().optional(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=agent.js.map
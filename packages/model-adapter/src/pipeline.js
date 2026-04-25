"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractionPipeline = exports.ExtractionError = void 0;
const neverthrow_1 = require("neverthrow");
const zod_1 = require("zod");
class ExtractionError extends Error {
    attempts;
    lastError;
    constructor(message, attempts, lastError) {
        super(message);
        this.attempts = attempts;
        this.lastError = lastError;
        this.name = 'ExtractionError';
    }
}
exports.ExtractionError = ExtractionError;
const DEFAULT_OPTIONS = { maxRepairAttempts: 2 };
class ExtractionPipeline {
    router;
    options;
    constructor(router, options = DEFAULT_OPTIONS) {
        this.router = router;
        this.options = options;
    }
    async extract(markdown, schema, options) {
        const opts = { ...this.options, ...options };
        const selection = this.router.selectForText();
        if (selection.isErr()) {
            return (0, neverthrow_1.err)(new ExtractionError(`No model available: ${selection.error.message}`, 0, undefined));
        }
        const model = selection.value;
        if (opts.logger) {
            model.setLogger(opts.logger);
        }
        let attempt = 0;
        attempt += 1;
        const extractResult = await model.extractJson(markdown, schema);
        if (extractResult.isOk()) {
            return (0, neverthrow_1.ok)(extractResult.value);
        }
        if (extractResult.error.code !== 'INVALID_RESPONSE') {
            return (0, neverthrow_1.err)(new ExtractionError(`Extraction failed: ${extractResult.error.message}`, attempt, extractResult.error));
        }
        const zodError = extractResult.error.cause instanceof zod_1.z.ZodError
            ? extractResult.error.cause
            : undefined;
        const rawResponse = extractResult.error.rawResponse ?? '{}';
        if (!zodError) {
            return (0, neverthrow_1.err)(new ExtractionError(`Extraction failed with INVALID_RESPONSE but no ZodError details`, attempt, extractResult.error));
        }
        let lastZodError = zodError;
        let lastRawJson = rawResponse;
        for (let i = 0; i < opts.maxRepairAttempts; i += 1) {
            attempt += 1;
            const repairResult = await model.repairJson(lastRawJson, lastZodError, schema);
            if (repairResult.isOk()) {
                return (0, neverthrow_1.ok)(repairResult.value);
            }
            if (repairResult.error.code !== 'INVALID_RESPONSE') {
                return (0, neverthrow_1.err)(new ExtractionError(`Repair attempt ${attempt} failed: ${repairResult.error.message}`, attempt, repairResult.error));
            }
            if (repairResult.error.cause instanceof zod_1.z.ZodError) {
                lastZodError = repairResult.error.cause;
            }
            lastRawJson = repairResult.error.rawResponse ?? lastRawJson;
        }
        return (0, neverthrow_1.err)(new ExtractionError(`Extraction failed after ${attempt} attempts`, attempt, lastZodError));
    }
}
exports.ExtractionPipeline = ExtractionPipeline;
//# sourceMappingURL=pipeline.js.map
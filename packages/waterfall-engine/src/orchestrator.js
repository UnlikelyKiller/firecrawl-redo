"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaterfallOrchestrator = void 0;
const neverthrow_1 = require("neverthrow");
class WaterfallOrchestrator {
    engines;
    onAttempt;
    constructor(engines, onAttempt) {
        this.engines = engines;
        this.onAttempt = onAttempt;
    }
    async scrape(request) {
        const sorted = [...this.engines].sort((a, b) => a.priority - b.priority);
        let lastFailure;
        const attempts = [];
        for (const engine of sorted) {
            if (!engine.supports(request))
                continue;
            const start = Date.now();
            const result = await engine.scrape(request);
            const latencyMs = Date.now() - start;
            if (result.isOk()) {
                const attempt = { engineName: engine.name, success: true, latencyMs };
                attempts.push(attempt);
                this.onAttempt?.(attempt);
                return (0, neverthrow_1.ok)({ response: result.value, attempts, engineUsed: engine.name });
            }
            const attempt = {
                engineName: engine.name,
                success: false,
                failure: result.error,
                latencyMs,
            };
            attempts.push(attempt);
            this.onAttempt?.(attempt);
            lastFailure = result.error;
        }
        return (0, neverthrow_1.err)(lastFailure || { code: 'UNKNOWN', message: 'No supported engine found', engineName: 'waterfall-orchestrator' });
    }
}
exports.WaterfallOrchestrator = WaterfallOrchestrator;
//# sourceMappingURL=orchestrator.js.map
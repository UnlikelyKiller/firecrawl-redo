"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualSeedProvider = void 0;
const neverthrow_1 = require("neverthrow");
class ManualSeedProvider {
    name = 'manual-seeds';
    seeds;
    constructor(seeds) {
        this.seeds = new Map(Object.entries(seeds));
    }
    search(query, _limit) {
        const normalizedQuery = query.trim().toLowerCase();
        const results = this.seeds.get(normalizedQuery);
        if (!results || results.length === 0) {
            return (0, neverthrow_1.errAsync)({
                code: 'NO_RESULTS',
                message: `No seeded results for query: ${query}`,
                provider: this.name,
            });
        }
        return (0, neverthrow_1.okAsync)({
            results,
            query,
        });
    }
}
exports.ManualSeedProvider = ManualSeedProvider;
//# sourceMappingURL=manual-seeds.js.map
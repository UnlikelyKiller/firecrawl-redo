"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearXNGProvider = void 0;
const neverthrow_1 = require("neverthrow");
class SearXNGProvider {
    baseUrl;
    name = 'searxng';
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    search(query, limit = 10) {
        if (!query.trim()) {
            return (0, neverthrow_1.errAsync)({
                code: 'INVALID_QUERY',
                message: 'Query must not be empty',
                provider: this.name,
            });
        }
        const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`;
        return neverthrow_1.ResultAsync.fromPromise(fetch(url).then(res => res.json()), (e) => ({
            code: 'PROVIDER_UNAVAILABLE',
            message: 'Failed to reach SearXNG instance',
            provider: this.name,
            cause: e,
        })).andThen((body) => {
            const raw = body.results ?? [];
            const results = raw
                .filter((r) => typeof r.title === 'string' && typeof r.url === 'string')
                .map((r) => ({
                title: r.title,
                url: r.url,
                snippet: typeof r.snippet === 'string' ? r.snippet : '',
                ...(typeof r.score === 'number' ? { relevanceScore: r.score } : {}),
            }));
            if (results.length === 0) {
                return (0, neverthrow_1.errAsync)({
                    code: 'NO_RESULTS',
                    message: 'No results found for query',
                    provider: this.name,
                });
            }
            return (0, neverthrow_1.okAsync)({
                results,
                query,
                ...(typeof body.number_of_results === 'number' ? { totalResults: body.number_of_results } : {}),
            });
        });
    }
}
exports.SearXNGProvider = SearXNGProvider;
//# sourceMappingURL=searxng.js.map
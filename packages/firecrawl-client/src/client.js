"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlClient = exports.FirecrawlClientError = void 0;
const undici_1 = require("undici");
const neverthrow_1 = require("neverthrow");
const opossum_1 = __importDefault(require("opossum"));
const src_1 = require("../../firecrawl-compat/src");
class FirecrawlClientError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'FirecrawlClientError';
    }
}
exports.FirecrawlClientError = FirecrawlClientError;
class FirecrawlClient {
    options;
    breaker;
    baseUrl;
    constructor(options) {
        this.options = options;
        this.baseUrl = `${options.protocol}://${options.host}:${options.port}`;
        const fetchWithTimeout = async (url, init) => {
            const response = await (0, undici_1.fetch)(url, init);
            return response;
        };
        this.breaker = new opossum_1.default(fetchWithTimeout, {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 10000,
            ...options.circuitBreakerOptions,
        });
    }
    scrape(request) {
        const url = `${this.baseUrl}/v1/scrape`;
        const init = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {}),
            },
            body: JSON.stringify(request),
        };
        return neverthrow_1.ResultAsync.fromPromise(this.breaker.fire(url, init), e => new FirecrawlClientError('Network or Circuit Breaker error', e)).andThen((response) => {
            return neverthrow_1.ResultAsync.fromPromise(response.json(), e => new FirecrawlClientError('Failed to parse JSON response', e)).andThen(json => {
                const result = src_1.ScrapeResponseSchema.safeParse(json);
                if (!result.success) {
                    return (0, neverthrow_1.err)(new FirecrawlClientError('Invalid response schema from Firecrawl', result.error));
                }
                return (0, neverthrow_1.ok)(result.data);
            });
        });
    }
    async health() {
        try {
            const response = await (0, undici_1.fetch)(`${this.baseUrl}/health`);
            return (0, neverthrow_1.ok)(response.status === 200);
        }
        catch (e) {
            return (0, neverthrow_1.err)(new FirecrawlClientError('Health check failed', e));
        }
    }
}
exports.FirecrawlClient = FirecrawlClient;
//# sourceMappingURL=client.js.map
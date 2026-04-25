"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlJsEngine = void 0;
const neverthrow_1 = require("neverthrow");
function mapClientError(e, engineName) {
    return {
        code: 'UPSTREAM_DOWN',
        message: e.message,
        engineName,
        cause: e.cause,
    };
}
class FirecrawlJsEngine {
    client;
    name = 'firecrawl-js';
    priority = 20;
    constructor(client) {
        this.client = client;
    }
    supports(_input) {
        return true;
    }
    async scrape(input) {
        return this.client
            .scrape(input)
            .andThen((response) => {
            if (!response.data ||
                (!response.data.markdown && !response.data.html && !response.data.rawHtml)) {
                return (0, neverthrow_1.err)({
                    code: 'CONTENT_EMPTY',
                    message: 'JS engine returned empty content',
                    engineName: this.name,
                });
            }
            return (0, neverthrow_1.ok)(response);
        })
            .mapErr((e) => {
            if (typeof e === 'object' && e !== null && 'code' in e)
                return e;
            return mapClientError(e, this.name);
        });
    }
}
exports.FirecrawlJsEngine = FirecrawlJsEngine;
//# sourceMappingURL=firecrawl-js.js.map
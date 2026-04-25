"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlCloudEngine = void 0;
const neverthrow_1 = require("neverthrow");
class FirecrawlCloudEngine {
    name = 'firecrawl-cloud';
    priority = 80;
    supports(_input) {
        return true;
    }
    async scrape(input) {
        const apiKey = process.env.FIRECRAWL_CLOUD_API_KEY;
        if (!apiKey) {
            return (0, neverthrow_1.err)({
                code: 'BLOCKED',
                message: 'Firecrawl Cloud API key not configured',
                engineName: this.name,
            });
        }
        try {
            // Basic fetch call to simulated Firecrawl Cloud API
            const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(input),
            });
            if (!response.ok) {
                return (0, neverthrow_1.err)({
                    code: 'UPSTREAM_DOWN',
                    message: `Firecrawl Cloud returned ${response.status}: ${response.statusText}`,
                    engineName: this.name,
                });
            }
            const data = await response.json();
            return (0, neverthrow_1.ok)(data);
        }
        catch (e) {
            return (0, neverthrow_1.err)({
                code: 'UNKNOWN',
                message: e instanceof Error ? e.message : 'Unknown error during Firecrawl Cloud fetch',
                engineName: this.name,
            });
        }
    }
}
exports.FirecrawlCloudEngine = FirecrawlCloudEngine;
//# sourceMappingURL=firecrawl-cloud.js.map
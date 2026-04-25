"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlPlaywrightEngine = void 0;
const neverthrow_1 = require("neverthrow");
class FirecrawlPlaywrightEngine {
    name = 'firecrawl-playwright';
    priority = 30;
    supports(_input) {
        return true;
    }
    async scrape(input) {
        return (0, neverthrow_1.ok)({
            success: true,
            data: {
                html: '<html><body>Firecrawl Playwright Content</body></html>',
                metadata: { engine: this.name, sourceUrl: input.url },
            },
        });
    }
}
exports.FirecrawlPlaywrightEngine = FirecrawlPlaywrightEngine;
//# sourceMappingURL=firecrawl-playwright.js.map
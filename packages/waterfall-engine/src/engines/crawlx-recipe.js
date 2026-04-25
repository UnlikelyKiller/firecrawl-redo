"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlxRecipeEngine = void 0;
const neverthrow_1 = require("neverthrow");
class CrawlxRecipeEngine {
    name = 'crawlx-recipe';
    priority = 50;
    supports(_input) {
        return true;
    }
    async scrape(input) {
        return (0, neverthrow_1.ok)({
            success: true,
            data: {
                html: '<html><body>Recipe Content</body></html>',
                metadata: { engine: this.name, sourceUrl: input.url },
            },
        });
    }
}
exports.CrawlxRecipeEngine = CrawlxRecipeEngine;
//# sourceMappingURL=crawlx-recipe.js.map
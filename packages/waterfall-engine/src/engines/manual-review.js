"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualReviewEngine = void 0;
const neverthrow_1 = require("neverthrow");
class ManualReviewEngine {
    name = 'manual-review';
    priority = 100;
    supports(_input) {
        return true;
    }
    async scrape(input) {
        // Return a specific failure code that indicates manual review is needed
        return (0, neverthrow_1.err)({
            code: 'LOGIN_REQUIRED', // This code is often used to trigger manual review in CrawlX
            message: 'Manual review required for this page',
            engineName: this.name,
        });
    }
}
exports.ManualReviewEngine = ManualReviewEngine;
//# sourceMappingURL=manual-review.js.map
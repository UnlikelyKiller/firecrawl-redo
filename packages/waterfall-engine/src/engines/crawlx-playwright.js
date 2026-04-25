"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlxPlaywrightEngine = void 0;
const neverthrow_1 = require("neverthrow");
class CrawlxPlaywrightEngine {
    options;
    name = 'crawlx-playwright';
    priority = 30;
    timeoutMs;
    constructor(options) {
        this.options = options;
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }
    supports(_input) {
        return true;
    }
    async scrape(input) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(`${this.options.baseUrl}/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: input.url }),
                signal: controller.signal,
            });
            if (!response.ok) {
                return (0, neverthrow_1.err)({
                    code: 'UPSTREAM_DOWN',
                    message: `Browser worker returned HTTP ${response.status}`,
                    engineName: this.name,
                });
            }
            const body = (await response.json());
            if (!body.success) {
                return (0, neverthrow_1.err)({
                    code: 'UPSTREAM_DOWN',
                    message: body.error ?? 'Browser worker returned unsuccessful response',
                    engineName: this.name,
                });
            }
            const data = this.mapToScrapeResponseData(body);
            if (!data?.markdown && !data?.html && !data?.rawHtml) {
                return (0, neverthrow_1.err)({
                    code: 'CONTENT_EMPTY',
                    message: 'Playwright engine returned empty content',
                    engineName: this.name,
                });
            }
            return (0, neverthrow_1.ok)({
                success: true,
                data,
            });
        }
        catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
                return (0, neverthrow_1.err)({
                    code: 'TIMEOUT',
                    message: `Browser worker request timed out after ${this.timeoutMs}ms`,
                    engineName: this.name,
                    cause: e,
                });
            }
            if (e instanceof TypeError && /ECONNREFUSED|fetch failed/i.test(String(e.message ?? e))) {
                return (0, neverthrow_1.err)({
                    code: 'UPSTREAM_DOWN',
                    message: 'Browser worker is unreachable',
                    engineName: this.name,
                    cause: e,
                });
            }
            return (0, neverthrow_1.err)({
                code: 'UNKNOWN',
                message: e instanceof Error ? e.message : String(e),
                engineName: this.name,
                cause: e,
            });
        }
        finally {
            clearTimeout(timer);
        }
    }
    mapToScrapeResponseData(body) {
        if (!body.hashes) {
            return {};
        }
        const metadata = {
            statusCode: body.statusCode,
            sourceUrl: body.url,
            title: body.title,
        };
        if (body.hashes.renderedHtml) {
            metadata.renderedHtmlHash = body.hashes.renderedHtml;
        }
        if (body.hashes.screenshotFull) {
            metadata.screenshotFullHash = body.hashes.screenshotFull;
        }
        if (body.hashes.screenshotViewport) {
            metadata.screenshotViewportHash = body.hashes.screenshotViewport;
        }
        if (body.hashes.ariaSnapshot) {
            metadata.ariaSnapshotHash = body.hashes.ariaSnapshot;
        }
        return {
            html: body.hashes.renderedHtml
                ? `hash:${body.hashes.renderedHtml}`
                : undefined,
            markdown: body.hashes.visibleText
                ? `hash:${body.hashes.visibleText}`
                : undefined,
            metadata,
        };
    }
}
exports.CrawlxPlaywrightEngine = CrawlxPlaywrightEngine;
//# sourceMappingURL=crawlx-playwright.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiloginCdpEngine = void 0;
const neverthrow_1 = require("neverthrow");
const playwright_core_1 = require("playwright-core");
class MultiloginCdpEngine {
    options;
    name = 'multilogin-cdp';
    priority = 35;
    capabilities = {
        usesCdp: true,
        requiresProfileId: true,
        supportsHostedBrowser: true,
        supportsSessionReuse: true,
        supportsProxyDelegation: true,
        supportsScrape: true,
        supportsScreenshots: false,
        supportsCookies: false,
        supportsActions: false,
    };
    timeoutMs;
    workerId;
    heartbeatIntervalMs;
    constructor(options = {}) {
        this.options = options;
        this.timeoutMs = options.timeoutMs ?? 45000;
        this.workerId = options.workerId ?? 'waterfall-engine';
        this.heartbeatIntervalMs = Math.max(5000, Math.min(30000, Math.floor(this.timeoutMs / 3)));
    }
    supports(input) {
        const hostname = this.getHostname(input.url);
        if (!hostname) {
            return false;
        }
        const allowedDomains = this.options.allowedDomains;
        if (!allowedDomains || allowedDomains.length === 0) {
            return false;
        }
        return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    }
    async scrape(input) {
        const unavailable = this.getUnavailableFailure();
        if (unavailable) {
            return (0, neverthrow_1.err)(unavailable);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const jobId = this.buildJobId();
        let leaseId;
        let browser;
        let heartbeat;
        try {
            const attachResponse = await this.postJson('/session/attach', {
                profileId: this.options.profileId,
                workerId: this.workerId,
                jobId,
            }, controller.signal);
            leaseId = attachResponse.leaseId;
            heartbeat = setInterval(() => {
                void this.safeHeartbeat(attachResponse.leaseId, jobId);
            }, this.heartbeatIntervalMs);
            heartbeat.unref();
      const endpoint = attachResponse.wsEndpoint ?? attachResponse.cdpUrl;
            if (!endpoint) {
                return (0, neverthrow_1.err)({
                    code: 'UPSTREAM_DOWN',
                    message: 'Bridge attach response did not include a CDP endpoint',
                    engineName: this.name,
                });
            }
            const connectedBrowser = await (this.options.connectOverCdp ?? playwright_core_1.chromium.connectOverCDP.bind(playwright_core_1.chromium))(endpoint, {
                timeout: this.timeoutMs,
            });
            browser = connectedBrowser;
            const context = connectedBrowser.contexts()[0] ?? await connectedBrowser.newContext();
            const page = context.pages()[0] ?? await context.newPage();
            const response = await page.goto(input.url, {
                timeout: this.timeoutMs,
                waitUntil: 'domcontentloaded',
            });
            await page.waitForLoadState('domcontentloaded', { timeout: this.timeoutMs });
            const html = await page.content();
            const visibleText = await page.locator('body').innerText().catch(() => '');
            const title = await page.title().catch(() => undefined);
            if (!html && !visibleText) {
                return (0, neverthrow_1.err)({
                    code: 'CONTENT_EMPTY',
                    message: 'Multilogin CDP engine returned empty content',
                    engineName: this.name,
                });
            }
            return (0, neverthrow_1.ok)({
                success: true,
                data: {
                    markdown: visibleText || undefined,
                    html: html || undefined,
                    rawHtml: html || undefined,
                    metadata: {
                        sourceUrl: page.url(),
                        title,
                        statusCode: response?.status(),
                        leaseId,
                        engine: this.name,
                        profileId: attachResponse.profileId,
                    },
                },
            });
        }
        catch (error) {
            return (0, neverthrow_1.err)(this.mapRuntimeError(error));
        }
        finally {
            clearTimeout(timer);
            if (heartbeat) {
                clearInterval(heartbeat);
            }
            if (browser) {
                await browser.close().catch(() => undefined);
            }
            if (leaseId) {
                await this.safeRelease(leaseId, jobId);
            }
        }
    }
    getUnavailableFailure() {
        const missing = this.getMissingConfiguration();
        const configured = missing.length === 0;
        const details = {
            configured,
            implemented: true,
            missing,
            capabilities: this.capabilities,
        };
        if (!configured) {
            return {
                code: 'NOT_CONFIGURED',
                message: `Multilogin CDP engine is not configured; missing ${missing.join(', ')}`,
                engineName: this.name,
                details,
            };
        }
        return null;
    }
    getMissingConfiguration() {
        const missing = [];
        if (!this.options.baseUrl) {
            missing.push('baseUrl');
        }
        if (!this.options.profileId) {
            missing.push('profileId');
        }
        if (!this.options.apiToken) {
            missing.push('apiToken');
        }
        return missing;
    }
    getHostname(url) {
        try {
            return new URL(url).hostname.toLowerCase();
        }
        catch {
            return null;
        }
    }
    async postJson(path, body, signal) {
        const response = await fetch(`${this.options.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bridge-secret': this.options.apiToken,
            },
            body: JSON.stringify(body),
            signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(typeof payload?.error === 'string'
                ? payload.error
                : `Bridge request failed with HTTP ${response.status}`);
        }
        return payload;
    }
    async safeRelease(leaseId, jobId) {
        try {
            await fetch(`${this.options.baseUrl}/session/release`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bridge-secret': this.options.apiToken,
                },
                body: JSON.stringify({ leaseId, jobId }),
            });
        }
        catch {
        }
    }
    async safeHeartbeat(leaseId, jobId) {
        try {
            await this.postJson('/session/heartbeat', { leaseId, jobId }, AbortSignal.timeout(Math.min(this.heartbeatIntervalMs, 5000)));
        }
        catch {
        }
    }
    mapRuntimeError(error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return {
                code: 'TIMEOUT',
                message: `Multilogin bridge request timed out after ${this.timeoutMs}ms`,
                engineName: this.name,
                cause: error,
            };
        }
        const message = error instanceof Error ? error.message : String(error);
        if (/not authorized|unauthorized|requires/i.test(message)) {
            return {
                code: 'BLOCKED',
                message,
                engineName: this.name,
                cause: error,
            };
        }
        if (/conflict|active lease|bridge|failed|http|cdp/i.test(message)) {
            return {
                code: 'UPSTREAM_DOWN',
                message,
                engineName: this.name,
                cause: error,
            };
        }
        return {
            code: 'UNKNOWN',
            message,
            engineName: this.name,
            cause: error,
        };
    }
    buildJobId() {
        return `mlx-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }
}
exports.MultiloginCdpEngine = MultiloginCdpEngine;

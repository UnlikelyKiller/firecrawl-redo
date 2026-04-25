import { Result, err, ok } from 'neverthrow';
import { chromium } from 'playwright-core';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from '../engine';

export interface TandemBrowserEngineCapabilities extends Record<string, unknown> {
  readonly usesCdp: true;
  readonly requiresProfileId: true;
  readonly supportsHostedBrowser: true;
  readonly supportsSessionReuse: true;
  readonly supportsProxyDelegation: true;
  readonly supportsScrape: true;
  readonly supportsScreenshots: true;
  readonly supportsCookies: false;
  readonly supportsA11ySnapshot: true;
}

export interface TandemBrowserEngineOptions {
  readonly baseUrl?: string;
  readonly tandemProfileId?: string;
  readonly apiToken?: string;
  readonly timeoutMs?: number;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly workerId?: string;
  readonly connectOverCdp?: typeof chromium.connectOverCDP;
}

export interface TandemBrowserEngineUnavailableDetails extends Record<string, unknown> {
  readonly configured: boolean;
  readonly implemented: boolean;
  readonly missing: ReadonlyArray<'baseUrl' | 'tandemProfileId' | 'apiToken'>;
  readonly capabilities: TandemBrowserEngineCapabilities;
}

interface TandemHealthResponse {
  readonly status: string;
  readonly version?: string;
}

interface TandemAttachResponse {
  readonly leaseId: string;
  readonly profileId: string;
  readonly wsEndpoint?: string;
  readonly cdpUrl?: string;
  readonly startedAt: string;
  readonly expiresAt: string;
}

interface TandemHeartbeatResponse {
  readonly success: boolean;
  readonly leaseId: string;
  readonly expiresAt: string;
}

export class TandemBrowserEngine implements CrawlEngine {
  readonly name = 'tandem-browser';
  readonly priority = 40;
  readonly capabilities: TandemBrowserEngineCapabilities = {
    usesCdp: true,
    requiresProfileId: true,
    supportsHostedBrowser: true,
    supportsSessionReuse: true,
    supportsProxyDelegation: true,
    supportsScrape: true,
    supportsScreenshots: true,
    supportsCookies: false,
    supportsA11ySnapshot: true,
  };

  private readonly timeoutMs: number;
  private readonly workerId: string;
  private readonly heartbeatIntervalMs: number;

  constructor(private readonly options: TandemBrowserEngineOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.workerId = options.workerId ?? 'waterfall-engine';
    this.heartbeatIntervalMs = Math.max(5_000, Math.min(30_000, Math.floor(this.timeoutMs / 3)));
  }

  supports(input: ScrapeRequest): boolean {
    const hostname = this.getHostname(input.url);
    if (!hostname) return false;

    const allowedDomains = this.options.allowedDomains;
    if (!allowedDomains || allowedDomains.length === 0) return false;

    return allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    const configFailure = this.getConfigurationFailure();
    if (configFailure) return err(configFailure);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const healthFailure = await this.probeHealth(controller.signal);
      if (healthFailure) return err(healthFailure);

      const jobId = this.buildJobId();
      let leaseId: string | undefined;
      let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
      let heartbeat: NodeJS.Timeout | undefined;

      try {
        const attachResponse = await this.postJson<TandemAttachResponse>(
          '/session/attach',
          {
            profileId: this.options.tandemProfileId,
            workerId: this.workerId,
            jobId,
          },
          controller.signal,
        );
        leaseId = attachResponse.leaseId;

        heartbeat = setInterval(() => {
          void this.safeHeartbeat(attachResponse.leaseId, jobId);
        }, this.heartbeatIntervalMs);
        heartbeat.unref();

        const endpoint = attachResponse.wsEndpoint ?? attachResponse.cdpUrl;
        if (!endpoint) {
          return err({
            code: 'UPSTREAM_DOWN',
            message: 'Tandem attach response did not include a WebSocket or CDP endpoint',
            engineName: this.name,
          });
        }

        const connectedBrowser = await (this.options.connectOverCdp ?? chromium.connectOverCDP.bind(chromium))(
          endpoint,
          { timeout: this.timeoutMs },
        );
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
          return err({
            code: 'CONTENT_EMPTY',
            message: 'Tandem browser engine returned empty content',
            engineName: this.name,
          });
        }

        return ok({
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
      } catch (error) {
        return err(this.mapRuntimeError(error));
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        if (browser) await browser.close().catch(() => undefined);
        if (leaseId) await this.safeRelease(leaseId, jobId);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private getConfigurationFailure(): CrawlFailure | null {
    const missing = this.getMissingConfiguration();
    if (missing.length === 0) return null;

    const details: TandemBrowserEngineUnavailableDetails = {
      configured: false,
      implemented: true,
      missing,
      capabilities: this.capabilities,
    };
    return {
      code: 'NOT_CONFIGURED',
      message: `Tandem browser engine is not configured; missing ${missing.join(', ')}`,
      engineName: this.name,
      details,
    };
  }

  private getMissingConfiguration(): Array<'baseUrl' | 'tandemProfileId' | 'apiToken'> {
    const missing: Array<'baseUrl' | 'tandemProfileId' | 'apiToken'> = [];
    if (!this.options.baseUrl) missing.push('baseUrl');
    if (!this.options.tandemProfileId) missing.push('tandemProfileId');
    if (!this.options.apiToken) missing.push('apiToken');
    return missing;
  }

  private async probeHealth(signal: AbortSignal): Promise<CrawlFailure | null> {
    try {
      const response = await fetch(`${this.options.baseUrl}/health`, {
        method: 'GET',
        headers: { 'x-tandem-secret': this.options.apiToken! },
        signal,
      });
      if (!response.ok) {
        return {
          code: 'UPSTREAM_DOWN',
          message: `Tandem health probe failed with HTTP ${response.status}`,
          engineName: this.name,
        };
      }
      const body = await response.json().catch(() => ({})) as TandemHealthResponse;
      if (body.status !== 'ok') {
        return {
          code: 'UPSTREAM_DOWN',
          message: `Tandem health probe returned status '${body.status}'`,
          engineName: this.name,
        };
      }
      return null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { code: 'TIMEOUT', message: 'Tandem health probe timed out', engineName: this.name, cause: error };
      }
      return { code: 'UPSTREAM_DOWN', message: 'Tandem health probe threw an error', engineName: this.name, cause: error };
    }
  }

  private async postJson<T>(path: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tandem-secret': this.options.apiToken!,
      },
      body: JSON.stringify(body),
      signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(
        new Error(typeof (payload as Record<string, unknown>)?.error === 'string'
          ? (payload as Record<string, unknown>).error as string
          : `Tandem request failed with HTTP ${response.status}`),
        { status: response.status },
      );
    }

    return payload as T;
  }

  private async safeRelease(leaseId: string, jobId: string): Promise<void> {
    try {
      await fetch(`${this.options.baseUrl}/session/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tandem-secret': this.options.apiToken!,
        },
        body: JSON.stringify({ leaseId, jobId }),
      });
    } catch {
      // Best-effort release; Tandem TTL still expires orphaned sessions.
    }
  }

  private async safeHeartbeat(leaseId: string, jobId: string): Promise<void> {
    try {
      await this.postJson<TandemHeartbeatResponse>(
        '/session/heartbeat',
        { leaseId, jobId },
        AbortSignal.timeout(Math.min(this.heartbeatIntervalMs, 5_000)),
      );
    } catch {
      // Best-effort heartbeat; scrape owns final release handling.
    }
  }

  private mapRuntimeError(error: unknown): CrawlFailure {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        code: 'TIMEOUT',
        message: `Tandem browser scrape timed out after ${this.timeoutMs}ms`,
        engineName: this.name,
        cause: error,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const status = (error instanceof Error && 'status' in error) ? (error as { status?: number }).status : undefined;

    if (status === 401 || /unauthorized|not authorized|invalid.*token/i.test(message)) {
      return { code: 'BLOCKED', message, engineName: this.name, cause: error };
    }
    if (status === 403 || /forbidden|policy denied/i.test(message)) {
      return { code: 'BLOCKED', message, engineName: this.name, cause: error };
    }
    if (/conflict|active lease|bridge|failed|http|cdp|tandem/i.test(message)) {
      return { code: 'UPSTREAM_DOWN', message, engineName: this.name, cause: error };
    }

    return { code: 'UNKNOWN', message, engineName: this.name, cause: error };
  }

  private getHostname(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private buildJobId(): string {
    return `tdm-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

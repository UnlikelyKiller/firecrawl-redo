import { Result, err, ok } from 'neverthrow';
import { chromium } from 'playwright-core';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from '../engine';

export interface MultiloginCdpEngineCapabilities extends Record<string, unknown> {
  readonly usesCdp: true;
  readonly requiresProfileId: true;
  readonly supportsHostedBrowser: true;
  readonly supportsSessionReuse: true;
  readonly supportsProxyDelegation: true;
  readonly supportsScrape: true;
  readonly supportsScreenshots: false;
  readonly supportsCookies: false;
  readonly supportsActions: false;
}

export interface MultiloginCdpEngineOptions {
  readonly baseUrl?: string;
  readonly profileId?: string;
  readonly apiToken?: string;
  readonly timeoutMs?: number;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly workerId?: string;
  readonly connectOverCdp?: typeof chromium.connectOverCDP;
}

export interface MultiloginCdpEngineUnavailableDetails extends Record<string, unknown> {
  readonly configured: boolean;
  readonly implemented: boolean;
  readonly missing: ReadonlyArray<'baseUrl' | 'profileId' | 'apiToken'>;
  readonly capabilities: MultiloginCdpEngineCapabilities;
}

interface AttachResponse {
  readonly leaseId: string;
  readonly profileId: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly cdpUrl?: string;
  readonly wsEndpoint?: string;
}

interface HeartbeatResponse {
  readonly success: boolean;
  readonly leaseId: string;
  readonly expiresAt: string;
}

export class MultiloginCdpEngine implements CrawlEngine {
  readonly name = 'multilogin-cdp';
  readonly priority = 35;
  readonly capabilities: MultiloginCdpEngineCapabilities = {
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
  private readonly timeoutMs: number;
  private readonly workerId: string;
  private readonly heartbeatIntervalMs: number;

  constructor(private readonly options: MultiloginCdpEngineOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.workerId = options.workerId ?? 'waterfall-engine';
    this.heartbeatIntervalMs = Math.max(5_000, Math.min(30_000, Math.floor(this.timeoutMs / 3)));
  }

  supports(input: ScrapeRequest): boolean {
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

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    const unavailable = this.getUnavailableFailure();
    if (unavailable) {
      return err(unavailable);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const jobId = this.buildJobId();
    let leaseId: string | undefined;
    let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
    let heartbeat: NodeJS.Timeout | undefined;

    try {
      const attachResponse = await this.postJson<AttachResponse>(
        '/session/attach',
        {
          profileId: this.options.profileId,
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
          message: 'Bridge attach response did not include a CDP endpoint',
          engineName: this.name,
        });
      }

      const connectedBrowser = await (this.options.connectOverCdp ?? chromium.connectOverCDP.bind(chromium))(endpoint, {
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
        return err({
          code: 'CONTENT_EMPTY',
          message: 'Multilogin CDP engine returned empty content',
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

  private getUnavailableFailure(): CrawlFailure | null {
    const missing = this.getMissingConfiguration();
    const configured = missing.length === 0;
    const details: MultiloginCdpEngineUnavailableDetails = {
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

  private getMissingConfiguration(): Array<'baseUrl' | 'profileId' | 'apiToken'> {
    const missing: Array<'baseUrl' | 'profileId' | 'apiToken'> = [];

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

  private getHostname(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-secret': this.options.apiToken!,
      },
      body: JSON.stringify(body),
      signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof payload?.error === 'string'
          ? payload.error
          : `Bridge request failed with HTTP ${response.status}`,
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
          'x-bridge-secret': this.options.apiToken!,
        },
        body: JSON.stringify({ leaseId, jobId }),
      });
    } catch {
      // Best-effort release; upstream lease cleanup still exists.
    }
  }

  private async safeHeartbeat(leaseId: string, jobId: string): Promise<void> {
    try {
      await this.postJson<HeartbeatResponse>(
        '/session/heartbeat',
        { leaseId, jobId },
        AbortSignal.timeout(Math.min(this.heartbeatIntervalMs, 5_000)),
      );
    } catch {
      // Best-effort heartbeat; scrape still owns final release handling.
    }
  }

  private mapRuntimeError(error: unknown): CrawlFailure {
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

  private buildJobId(): string {
    return `mlx-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

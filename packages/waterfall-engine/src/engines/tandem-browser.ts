import { Result, err, ok } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from '../engine';

export interface TandemBrowserEngineCapabilities extends Record<string, unknown> {
  readonly supportsScreenshots: true;
  readonly supportsA11ySnapshot: true;
}

export interface TandemBrowserEngineOptions {
  readonly baseUrl?: string;          // default 'http://127.0.0.1:8765'
  readonly apiToken?: string;         // Bearer token — required for non-public endpoints
  readonly timeoutMs?: number;        // default 30000
  readonly allowedDomains?: ReadonlyArray<string>;  // optional domain allowlist
}

export interface TandemBrowserEngineUnavailableDetails extends Record<string, unknown> {
  readonly configured: boolean;
  readonly implemented: boolean;
  readonly missing: ReadonlyArray<'apiToken'>;
  readonly capabilities: TandemBrowserEngineCapabilities;
}

interface TandemStatusResponse {
  readonly ok: boolean;
  readonly [key: string]: unknown;
}

interface TandemTabOpenResponse {
  readonly ok: boolean;
  readonly tab: {
    readonly id: string;
    readonly webContentsId: number;
    readonly [key: string]: unknown;
  };
}

interface TandemWaitResponse {
  readonly ok: boolean;
  readonly ready: boolean;
}

interface TandemPageContentResponse {
  readonly title: string;
  readonly url: string;
  readonly description: string;
  readonly text: string;
  readonly length: number;
}

interface TandemTabCloseResponse {
  readonly ok: boolean;
}

export class TandemBrowserEngine implements CrawlEngine {
  readonly name = 'tandem-browser';
  readonly priority = 40;
  readonly capabilities: TandemBrowserEngineCapabilities = {
    supportsScreenshots: true,
    supportsA11ySnapshot: true,
  };

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: TandemBrowserEngineOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://127.0.0.1:8765';
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  supports(input: ScrapeRequest): boolean {
    if (!this.options.apiToken) return false;

    const hostname = this.getHostname(input.url);
    if (!hostname) return false;

    const allowedDomains = this.options.allowedDomains;
    if (!allowedDomains || allowedDomains.length === 0) return true;

    return allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    const configFailure = this.getConfigurationFailure();
    if (configFailure) return err(configFailure);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let tabId: string | undefined;

    try {
      // Step 1: Health check (public route, no auth)
      const healthFailure = await this.probeHealth(controller.signal);
      if (healthFailure) return err(healthFailure);

      // Step 2: Open tab
      const openResponse = await this.postJson<TandemTabOpenResponse>(
        '/tabs/open',
        { 
          url: input.url, 
          source: 'robin', 
          focus: false,
          allowStealthCompromise: true, // Required for Windows-native Tandem
        },
        controller.signal,
      );
      tabId = openResponse.tab.id;

      try {
        // Step 3: Wait for page to be ready
        await this.postJson<TandemWaitResponse>(
          '/wait',
          { allowStealthCompromise: true },
          controller.signal,
          { 'X-Tab-Id': tabId },
        );

        // Step 4: Get text content
        const content = await this.getJson<TandemPageContentResponse>(
          '/page-content',
          { 'X-Tab-Id': tabId },
          controller.signal,
        );

        // Step 5: Get raw HTML
        const html = await this.getRaw(
          '/page-html',
          { 'X-Tab-Id': tabId },
          controller.signal,
        );

        return ok({
          success: true,
          data: {
            markdown: content.text,
            html,
            rawHtml: html,
            metadata: {
              title: content.title,
              sourceUrl: content.url,
              description: content.description,
              engine: this.name,
            },
          },
        });
      } catch (error) {
        return err(this.mapRuntimeError(error));
      } finally {
        // Step 6: Close tab (best effort, in finally)
        if (tabId) {
          await this.postJson<TandemTabCloseResponse>(
            '/tabs/close',
            { tabId },
            AbortSignal.timeout(5_000),
          ).catch(() => undefined);
        }
      }
    } catch (error) {
      if (tabId === undefined) {
        // Error happened during health check or tab open (before inner try block)
        return err(this.mapRuntimeError(error));
      }
      // Already handled inside inner try/catch
      return err(this.mapRuntimeError(error));
    } finally {
      clearTimeout(timer);
    }
  }

  private getConfigurationFailure(): CrawlFailure | null {
    const missing: Array<'apiToken'> = [];
    if (!this.options.apiToken) missing.push('apiToken');
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

  async probeHealth(signal: AbortSignal): Promise<CrawlFailure | null> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        signal,
      });
      if (!response.ok) {
        return {
          code: 'UPSTREAM_DOWN',
          message: `Tandem health probe failed with HTTP ${response.status}`,
          engineName: this.name,
        };
      }
      return null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { code: 'TIMEOUT', message: 'Tandem health probe timed out', engineName: this.name, cause: error };
      }
      return { code: 'UPSTREAM_DOWN', message: 'Tandem is unreachable', engineName: this.name, cause: error };
    }
  }

  async postJson<T>(
    path: string,
    body: Record<string, unknown>,
    signal: AbortSignal,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.apiToken}`,
        'x-allow-devtools': 'true', // Required for Windows-native Tandem
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(
        new Error(
          typeof (payload as Record<string, unknown>)?.error === 'string'
            ? (payload as Record<string, unknown>).error as string
            : `Tandem request to ${path} failed with HTTP ${response.status}`,
        ),
        { status: response.status },
      );
    }

    return payload as T;
  }

  async getJson<T>(
    path: string,
    extraHeaders: Record<string, string>,
    signal: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.options.apiToken}`,
        'x-allow-devtools': 'true', // Required for Windows-native Tandem
        ...extraHeaders,
      },
      signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(
        new Error(
          typeof (payload as Record<string, unknown>)?.error === 'string'
            ? (payload as Record<string, unknown>).error as string
            : `Tandem request to ${path} failed with HTTP ${response.status}`,
        ),
        { status: response.status },
      );
    }

    return payload as T;
  }

  private async getRaw(
    path: string,
    extraHeaders: Record<string, string>,
    signal: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.options.apiToken}`,
        'x-allow-devtools': 'true', // Required for Windows-native Tandem
        ...extraHeaders,
      },
      signal,
    });

    if (!response.ok) {
      throw Object.assign(
        new Error(`Tandem request to ${path} failed with HTTP ${response.status}`),
        { status: response.status },
      );
    }

    return response.text();
  }

  mapRuntimeError(error: unknown): CrawlFailure {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        code: 'TIMEOUT',
        message: `Tandem browser scrape timed out after ${this.timeoutMs}ms`,
        engineName: this.name,
        cause: error,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const status = (error instanceof Error && 'status' in error)
      ? (error as { status?: number }).status
      : undefined;

    if (status === 401 || /unauthorized|not authorized|invalid.*token/i.test(message)) {
      return { code: 'BLOCKED', message, engineName: this.name, cause: error };
    }
    if (status === 403 || /forbidden|policy denied/i.test(message)) {
      return { code: 'BLOCKED', message, engineName: this.name, cause: error };
    }
    if (
      status === 503 ||
      /connection refused|ECONNREFUSED|unreachable/i.test(message)
    ) {
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
}

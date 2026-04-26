import { Result, err, ok } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from '../engine';
import { BrowserWorkerClientOptions } from '../index.js';

interface BrowserWorkerScrapeResponse {
  readonly success: boolean;
  readonly hashes?: Readonly<Record<string, string>>;
  readonly statusCode: number;
  readonly url: string;
  readonly title: string;
  readonly engineName: string;
  readonly error?: string;
}

export class CrawlxRecipeEngine implements CrawlEngine {
  readonly name = 'crawlx-recipe';
  readonly priority = 50;
  private readonly timeoutMs: number;

  constructor(private readonly options: BrowserWorkerClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  supports(input: ScrapeRequest): boolean {
    // Recipe engine is only useful for URLs where a recipe is available.
    return !!(input.actions && input.actions.length > 0);
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.options.baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: input.url,
          mode: 'recipe',
          actions: input.actions,
          captureVideo: true,
          captureHar: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return err({
          code: 'UPSTREAM_DOWN',
          message: `Browser worker returned HTTP ${response.status}`,
          engineName: this.name,
        });
      }

      const body = (await response.json()) as BrowserWorkerScrapeResponse;

      if (!body.success) {
        const code = body.error?.toLowerCase().includes('no recipe')
          ? ('BLOCKED' as const)
          : ('UPSTREAM_DOWN' as const);
        return err({
          code,
          message: body.error ?? 'Recipe engine returned unsuccessful response',
          engineName: this.name,
        });
      }

      const data = this.mapToScrapeResponseData(body);

      if (!data?.markdown && !data?.html && !data?.rawHtml) {
        return err({
          code: 'CONTENT_EMPTY',
          message: 'Recipe engine returned empty content',
          engineName: this.name,
        });
      }

      return ok({ success: true, data });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return err({
          code: 'TIMEOUT',
          message: `Browser worker request timed out after ${this.timeoutMs}ms`,
          engineName: this.name,
          cause: e,
        });
      }

      if (e instanceof TypeError && /ECONNREFUSED|fetch failed/i.test(String(e.message ?? e))) {
        return err({
          code: 'UPSTREAM_DOWN',
          message: 'Browser worker is unreachable',
          engineName: this.name,
          cause: e,
        });
      }

      return err({
        code: 'UNKNOWN',
        message: e instanceof Error ? e.message : String(e),
        engineName: this.name,
        cause: e,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private mapToScrapeResponseData(body: BrowserWorkerScrapeResponse): ScrapeResponse['data'] {
    if (!body.hashes) return {};

    const metadata: Record<string, unknown> = {
      statusCode: body.statusCode,
      sourceUrl: body.url,
      title: body.title,
    };

    if (body.hashes.renderedHtml) metadata.renderedHtmlHash = body.hashes.renderedHtml;
    if (body.hashes.screenshotFull) metadata.screenshotFullHash = body.hashes.screenshotFull;
    if (body.hashes.screenshotViewport) metadata.screenshotViewportHash = body.hashes.screenshotViewport;
    if (body.hashes.ariaSnapshot) metadata.ariaSnapshotHash = body.hashes.ariaSnapshot;
    if (body.hashes.videoReceipt) metadata.videoReceiptHash = body.hashes.videoReceipt;
    if (body.hashes.har) metadata.harHash = body.hashes.har;

    return {
      html: body.hashes.renderedHtml ? `hash:${body.hashes.renderedHtml}` : undefined,
      markdown: body.hashes.visibleText ? `hash:${body.hashes.visibleText}` : undefined,
      metadata,
    };
  }
}

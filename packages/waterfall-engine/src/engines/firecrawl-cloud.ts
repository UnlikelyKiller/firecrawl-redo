import { Result, ok, err } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '@crawlx/firecrawl-compat';
import { CrawlEngine, CrawlFailure } from '../engine.js';

export interface FirecrawlCloudOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
}

export class FirecrawlCloudEngine implements CrawlEngine {
  readonly name = 'firecrawl-cloud';
  readonly priority = 80;

  constructor(private readonly options: FirecrawlCloudOptions) {}

  supports(_input: ScrapeRequest): boolean {
    return !!this.options.apiKey;
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    const baseUrl = this.options.baseUrl || 'https://api.firecrawl.com';
    
    try {
      const response = await fetch(`${baseUrl}/v1/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        return err({
          code: 'UPSTREAM_DOWN',
          message: `Firecrawl Cloud returned HTTP ${response.status}`,
          engineName: this.name,
        });
      }

      const body = await response.json() as any;
      return ok(body);
    } catch (e: unknown) {
      return err({
        code: 'UNKNOWN',
        message: e instanceof Error ? e.message : String(e),
        engineName: this.name,
        cause: e,
      });
    }
  }
}

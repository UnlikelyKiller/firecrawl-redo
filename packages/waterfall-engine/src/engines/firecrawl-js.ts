import { Result, ok, err } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from '../engine';
import { FirecrawlClient, FirecrawlClientError } from '../../../firecrawl-client/src';

function mapClientError(e: FirecrawlClientError, engineName: string): CrawlFailure {
  return {
    code: 'UPSTREAM_DOWN',
    message: e.message,
    engineName,
    cause: e.cause,
  };
}

export class FirecrawlJsEngine implements CrawlEngine {
  readonly name = 'firecrawl-js';
  readonly priority = 20;

  constructor(private readonly client: FirecrawlClient) {}

  supports(_input: ScrapeRequest): boolean {
    return true;
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    return this.client
      .scrape(input)
      .andThen((response): Result<ScrapeResponse, CrawlFailure> => {
        if (
          !response.data ||
          (!response.data.markdown && !response.data.html && !response.data.rawHtml)
        ) {
          return err({
            code: 'CONTENT_EMPTY',
            message: 'JS engine returned empty content',
            engineName: this.name,
          });
        }
        return ok(response);
      })
      .mapErr((e): CrawlFailure => {
        if (typeof e === 'object' && e !== null && 'code' in e) return e as CrawlFailure;
        return mapClientError(e as FirecrawlClientError, this.name);
      });
  }
}
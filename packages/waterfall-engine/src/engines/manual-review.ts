import { Result, err } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '@crawlx/firecrawl-compat';
import { CrawlEngine, CrawlFailure } from '../engine.js';

export class ManualReviewEngine implements CrawlEngine {
  readonly name = 'manual-review';
  readonly priority = 70;

  supports(_input: ScrapeRequest): boolean {
    return true;
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    // All automated engines were exhausted. Signal to the caller that this URL
    // requires human intervention. The caller is responsible for logging the
    // pending review to the appropriate queue.
    return err({
      code: 'PENDING_REVIEW',
      message: `URL requires manual review: ${input.url}`,
      engineName: this.name,
    });
  }
}

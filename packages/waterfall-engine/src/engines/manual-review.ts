import { Result, err } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '@crawlx/firecrawl-compat';
import { CrawlEngine, CrawlFailure } from '../engine.js';

export interface ManualReviewLogger {
  logReview(url: string, jobId?: string, reason?: string): Promise<void>;
}

export class ManualReviewEngine implements CrawlEngine {
  readonly name = 'manual-review';
  readonly priority = 70;

  constructor(private readonly logger?: ManualReviewLogger, private readonly jobId?: string) {}

  supports(_input: ScrapeRequest): boolean {
    return true;
  }

  async scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>> {
    // All automated engines were exhausted. Signal to the caller that this URL
    // requires human intervention.
    
    if (this.logger) {
      await this.logger.logReview(input.url, this.jobId, 'All automated engines exhausted').catch(() => {
        // Best effort logging
      });
    }

    return err({
      code: 'PENDING_REVIEW',
      message: `URL requires manual review: ${input.url}`,
      engineName: this.name,
    });
  }
}

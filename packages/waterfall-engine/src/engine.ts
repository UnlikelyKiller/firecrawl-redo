import { Result } from 'neverthrow';
import {
  ScrapeRequest,
  ScrapeResponse,
} from '../../firecrawl-compat/src';

export type FailureCode =
  | 'TIMEOUT'
  | 'BLOCKED'
  | 'SSRF_VIOLATION'
  | 'UPSTREAM_DOWN'
  | 'UNKNOWN'
  | 'CAPTCHA_DETECTED'
  | 'LOGIN_REQUIRED'
  | 'CONTENT_EMPTY'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED';

export interface CrawlFailure {
  readonly code: FailureCode;
  readonly message: string;
  readonly engineName: string;
  readonly cause?: unknown;
}

export interface CrawlEngine {
  readonly name: string;
  readonly priority: number;
  supports(input: ScrapeRequest): boolean;
  scrape(input: ScrapeRequest): Promise<Result<ScrapeResponse, CrawlFailure>>;
}
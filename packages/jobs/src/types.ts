import { 
  ScrapeRequest, 
  CrawlRequest,
} from '../../firecrawl-compat/src';

export enum JobType {
  SCRAPE = 'SCRAPE',
  CRAWL = 'CRAWL',
  MAP = 'MAP',
  SEARCH = 'SEARCH',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPLETED_WITH_WARNINGS = 'COMPLETED_WITH_WARNINGS',
  CANCELLED = 'CANCELLED',
}

export interface JobData {
  readonly type: JobType;
  readonly payload: ScrapeRequest | CrawlRequest;
  readonly createdAt: number;
}

export interface JobResult {
  readonly success: boolean;
  readonly data?: any;
  readonly error?: string;
  readonly artifacts?: ReadonlyArray<{
    readonly hash: string;
    readonly extension: string;
  }>;
}

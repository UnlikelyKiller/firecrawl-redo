export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type JobType = "scrape" | "crawl" | "map" | "extract";

export type EngineName =
  | "fire-engine"
  | "cheerio"
  | "puppeteer"
  | "playwright";

export type PageStatus = "scraped" | "changed" | "unchanged" | "failed";

export type ExtractionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "validation_error";

export type DomainPolicyAction = "allow" | "block" | "rate_limit";

export interface Job {
  readonly id: string;
  readonly seed_url: string;
  readonly job_type: JobType;
  readonly status: JobStatus;
  readonly created_at: string;
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly engine?: EngineName;
  readonly pages_scraped: number;
  readonly error_message?: string;
  readonly cost_cents?: number;
}

export interface JobDetail extends Job {
  readonly waterfall: readonly WaterfallStep[];
  readonly artifacts: readonly Artifact[];
  readonly extraction?: ExtractionResult;
  readonly llm_calls: readonly LlmCall[];
}

export interface WaterfallStep {
  readonly engine: EngineName;
  readonly started_at: string;
  readonly completed_at?: string;
  readonly status: "success" | "failed" | "timeout";
  readonly error_message?: string;
  readonly attempt: number;
}

export interface Artifact {
  readonly content_hash: string;
  readonly content_type: "html" | "markdown" | "screenshot" | "pdf";
  readonly size_bytes: number;
  readonly created_at: string;
}

export interface ExtractionResult {
  readonly schema_id: string;
  readonly status: ExtractionStatus;
  readonly confidence: number;
  readonly extracted_at: string;
  readonly validation_errors?: readonly string[];
}

export interface LlmCall {
  readonly id: string;
  readonly model: string;
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly cost_cents: number;
  readonly created_at: string;
}

export interface ScrapePage {
  readonly id: string;
  readonly url: string;
  readonly content_hash: string;
  readonly status: PageStatus;
  readonly status_code?: number;
  readonly last_scraped_at: string;
  readonly change_indicator?: "new" | "changed" | "unchanged";
}

export interface Failure {
  readonly id: string;
  readonly job_id: string;
  readonly url: string;
  readonly engine: EngineName;
  readonly error_class: string;
  readonly error_message: string;
  readonly occurred_at: string;
  readonly domain: string;
}

export interface FailureGroup {
  readonly error_class: string;
  readonly count: number;
  readonly domains: readonly string[];
  readonly latest_at: string;
}

export interface EngineSuccessRate {
  readonly engine: EngineName;
  readonly total: number;
  readonly succeeded: number;
  readonly rate: number;
}

export interface DomainPolicy {
  readonly domain: string;
  readonly action: DomainPolicyAction;
  readonly rate_limit_rpm?: number;
  readonly max_depth?: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Extraction {
  readonly id: string;
  readonly job_id: string;
  readonly schema_id: string;
  readonly status: ExtractionStatus;
  readonly confidence: number;
  readonly created_at: string;
  readonly validation_errors?: readonly string[];
}

export interface ActivityLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly endpoint: string;
  readonly method: string;
  readonly correlation_id: string;
  readonly response_status: number;
  readonly latency_ms: number;
}

export interface UsageEntry {
  readonly date: string;
  readonly llm_tokens: number;
  readonly browser_seconds: number;
  readonly pages_scraped: number;
  readonly cost_cents: number;
}

export interface BrowserReceipt {
  readonly id: string;
  readonly job_id: string;
  readonly url: string;
  readonly video_url?: string;
  readonly aria_snapshot?: string;
  readonly action_timeline: readonly ActionTimelineEntry[];
  readonly created_at: string;
}

export interface ActionTimelineEntry {
  readonly action: string;
  readonly selector?: string;
  readonly value?: string;
  readonly timestamp: string;
  readonly duration_ms: number;
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
}

export type JobsResponse = PaginatedResponse<Job>;
export type PagesResponse = PaginatedResponse<ScrapePage>;
export type FailuresResponse = PaginatedResponse<Failure>;
export type ExtractionsResponse = PaginatedResponse<Extraction>;
export type ActivityResponse = PaginatedResponse<ActivityLogEntry>;
export type UsageResponse = readonly UsageEntry[];
export type ReceiptsResponse = PaginatedResponse<BrowserReceipt>;
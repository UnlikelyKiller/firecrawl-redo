export { CrawlEngine, CrawlFailure, FailureCode } from './engine.js';
export {
  WaterfallOrchestrator,
  WaterfallResult,
  EngineAttempt,
  OnEngineAttempt,
  ScrapeContext,
} from './orchestrator.js';

export interface BrowserWorkerClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

export * from './engines/index.js';


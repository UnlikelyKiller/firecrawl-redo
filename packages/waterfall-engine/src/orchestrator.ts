import { Result, ok, err } from 'neverthrow';
import { ScrapeRequest, ScrapeResponse } from '../../firecrawl-compat/src';
import { CrawlEngine, CrawlFailure } from './engine';

export interface ScrapeContext {
  readonly lease?: { readonly id: string; readonly profileId: string; readonly leaseToken: string };
  readonly profile?: { readonly id: string; readonly tenantId: string | null };
  readonly policy?: Record<string, unknown>;
}

export interface EngineAttempt {
  readonly engineName: string;
  readonly success: boolean;
  readonly failure?: CrawlFailure;
  readonly latencyMs: number;
}

export interface WaterfallResult {
  readonly response: ScrapeResponse;
  readonly attempts: ReadonlyArray<EngineAttempt>;
  readonly engineUsed: string;
}

export type OnEngineAttempt = (attempt: EngineAttempt) => void;

export class WaterfallOrchestrator {
  constructor(
    private readonly engines: ReadonlyArray<CrawlEngine>,
    private readonly onAttempt?: OnEngineAttempt,
  ) {}

  async scrape(request: ScrapeRequest, context?: ScrapeContext): Promise<Result<WaterfallResult, CrawlFailure>> {
    const sorted = [...this.engines].sort((a, b) => a.priority - b.priority);
    let lastFailure: CrawlFailure | undefined;
    const attempts: EngineAttempt[] = [];

    for (const engine of sorted) {
      if (!engine.supports(request)) continue;

      if (engine.requiresLease && !context?.lease) {
        const leaseFailure: CrawlFailure = {
          code: 'BLOCKED',
          message: `Engine '${engine.name}' requires a profile lease but none was provided`,
          engineName: engine.name,
        };
        const attempt: EngineAttempt = {
          engineName: engine.name,
          success: false,
          failure: leaseFailure,
          latencyMs: 0,
        };
        attempts.push(attempt);
        this.onAttempt?.(attempt);
        lastFailure = leaseFailure;
        continue;
      }

      const start = Date.now();
      const result = await engine.scrape(request);
      const latencyMs = Date.now() - start;

      if (result.isOk()) {
        const attempt: EngineAttempt = { engineName: engine.name, success: true, latencyMs };
        attempts.push(attempt);
        this.onAttempt?.(attempt);
        return ok({ response: result.value, attempts, engineUsed: engine.name });
      }

      const attempt: EngineAttempt = {
        engineName: engine.name,
        success: false,
        failure: result.error,
        latencyMs,
      };
      attempts.push(attempt);
      this.onAttempt?.(attempt);
      lastFailure = result.error;

      // Short-circuit: if the engine signals a pending manual review, stop the waterfall.
      if (result.error.code === 'PENDING_REVIEW') {
        return err(result.error);
      }
    }

    return err(
      lastFailure || { code: 'UNKNOWN', message: 'No supported engine found', engineName: 'waterfall-orchestrator' },
    );
  }
}
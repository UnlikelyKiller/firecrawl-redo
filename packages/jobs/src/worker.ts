import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ok, err, Result } from 'neverthrow';
import { FirecrawlClient } from '../../firecrawl-client/src';
import { ContentAddressedStore } from '../../artifact-store/src';
import { JobData, JobResult, JobType, JobStatus } from './types';
import { ScrapeRequest } from '../../firecrawl-compat/src';
import { JobPersistenceService } from './persistence';
import {
  WaterfallOrchestrator,
  CrawlEngine,
  EngineAttempt,
  ScrapeContext,
  MultiloginCdpEngine,
  TandemBrowserEngine,
  ManualReviewEngine,
  type ManualReviewLogger,
  type MultiloginCdpEngineOptions,
  type TandemBrowserEngineOptions,
} from '../../waterfall-engine/src/index.js';
import { FirecrawlStaticEngine } from '../../waterfall-engine/src/engines/firecrawl-static.js';
import { FirecrawlJsEngine } from '../../waterfall-engine/src/engines/firecrawl-js.js';
import { CrawlxPlaywrightEngine } from '../../waterfall-engine/src/engines/crawlx-playwright.js';

class DrizzleManualReviewLogger implements ManualReviewLogger {
  constructor(private readonly persistence: JobPersistenceService) {}
  async logReview(url: string, jobId?: string, reason?: string): Promise<void> {
    await this.persistence.recordManualReview({ url, jobId, reason });
  }
}

export interface PlaywrightOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

export interface MultiloginOptions extends MultiloginCdpEngineOptions {
  readonly enabled?: boolean;
  readonly resolveEligibility?: (
    url: string,
  ) => Promise<{
    readonly allowed: boolean;
    readonly required?: boolean;
    readonly allowedDomains?: ReadonlyArray<string>;
    readonly profileId?: string;
    readonly error?: string;
  }> |
    {
      readonly allowed: boolean;
      readonly required?: boolean;
      readonly allowedDomains?: ReadonlyArray<string>;
      readonly profileId?: string;
      readonly error?: string;
    };
}

export interface TandemEligibilityResult {
  readonly allowed: boolean;
  readonly required?: boolean;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly apiToken?: string;
  readonly error?: string;
}

export interface TandemOptions extends TandemBrowserEngineOptions {
  readonly enabled?: boolean;
  readonly resolveEligibility?: (url: string) => Promise<TandemEligibilityResult> | TandemEligibilityResult;
}

interface BuildEnginesResult {
  readonly engines: CrawlEngine[];
  readonly context?: ScrapeContext;
}

export class ScrapeWorker {
  private worker: Worker<JobData, JobResult>;

  constructor(
    private readonly redisConnection: Redis,
    private readonly store: ContentAddressedStore,
    private readonly persistence: JobPersistenceService,
    private readonly client: FirecrawlClient,
    private readonly playwrightOptions?: PlaywrightOptions,
    private readonly multiloginOptions?: MultiloginOptions,
    private readonly tandemOptions?: TandemOptions,
    queueName: string = 'scrape-queue'
  ) {
    this.worker = new Worker<JobData, JobResult>(
      queueName,
      async (job: Job<JobData, JobResult>) => {
        return this.processJob(job);
      },
      { connection: this.redisConnection }
    );
  }

  private async recordAttempt(jobId: string, attempt: EngineAttempt): Promise<void> {
    const attemptData: {
      jobId: string;
      engineName: string;
      status: string;
      latencyMs: number;
      error?: string;
    } = {
      jobId,
      engineName: attempt.engineName,
      status: attempt.success ? 'COMPLETED' : 'FAILED',
      latencyMs: attempt.latencyMs,
    };
    if (!attempt.success && attempt.failure) {
      attemptData.error = attempt.failure.message;
    }
    await this.persistence.recordEngineAttempt(attemptData);
  }

  private async processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
    const { type, payload } = job.data;
    const jobId = job.id;

    if (!jobId) {
      return { success: false, error: 'Job ID is missing' };
    }

    try {
      await this.persistence.updateJobStatus(jobId, JobStatus.RUNNING);

      if (type !== JobType.SCRAPE) {
        const error = `Unsupported job type: ${type}`;
        await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, error);
        return { success: false, error };
      }

      const buildResult = await this.buildEngines(payload.url, jobId);
      if (buildResult.isErr()) {
        await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, buildResult.error);
        return { success: false, error: buildResult.error };
      }

      const { engines, context } = buildResult.value;

      const orchestrator = new WaterfallOrchestrator(
        engines,
        (attempt) => { this.recordAttempt(jobId, attempt); },
      );

      const scrapeResult = await orchestrator.scrape(payload as ScrapeRequest, context);

      if (scrapeResult.isErr()) {
        const error = scrapeResult.error.message;
        await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, error);
        return { success: false, error };
      }

      const data = scrapeResult.value.response;
      const artifacts: Array<{ hash: string; extension: string }> = [];

      let markdownHash: string | undefined;
      let rawHtmlHash: string | undefined;
      let metadataHash: string | undefined;

      if (data.data) {
        if (data.data.markdown) {
          const hashResult = await this.store.store(data.data.markdown, 'md');
          if (hashResult.isOk()) {
            markdownHash = hashResult.value;
            artifacts.push({ hash: markdownHash, extension: 'md' });
            data.data.markdown = `hash:${markdownHash}`;
          }
        }
        if (data.data.html || data.data.rawHtml) {
          const html = data.data.html || data.data.rawHtml;
          if (html) {
            const hashResult = await this.store.store(html, 'html');
            if (hashResult.isOk()) {
              rawHtmlHash = hashResult.value;
              artifacts.push({ hash: rawHtmlHash, extension: 'html' });
              if (data.data.html) data.data.html = `hash:${rawHtmlHash}`;
              if (data.data.rawHtml) data.data.rawHtml = `hash:${rawHtmlHash}`;
            }
          }
        }
        if (data.data.metadata) {
          const metadataStr = JSON.stringify(data.data.metadata);
          const hashResult = await this.store.store(metadataStr, 'json');
          if (hashResult.isOk()) {
            metadataHash = hashResult.value;
            artifacts.push({ hash: metadataHash, extension: 'json' });
          }
        }

        await this.persistence.savePage({
          jobId,
          canonicalUrl: payload.url,
          normalizedUrl: payload.url,
          statusCode: data.data.metadata?.statusCode ?? 200,
          contentType: data.data.metadata?.contentType ?? 'text/html',
          markdownHash,
          rawHtmlHash,
          metadataHash,
          renderedHtmlHash: data.data.metadata?.renderedHtmlHash,
          screenshotHash: data.data.metadata?.screenshotFullHash || data.data.metadata?.screenshotViewportHash,
        });
      }

      await this.persistence.updateJobStatus(jobId, JobStatus.COMPLETED);

      return {
        success: true,
        data: data,
        artifacts: artifacts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, message);
      return { success: false, error: message };
    }
  }

  async close() {
    await this.worker.close();
  }

  private async buildEngines(url: string, jobId?: string): Promise<Result<BuildEnginesResult, string>> {
    const engines: CrawlEngine[] = [
      new FirecrawlStaticEngine(this.client),
      new FirecrawlJsEngine(this.client),
    ];

    const manualReviewEngine = new ManualReviewEngine(
      new DrizzleManualReviewLogger(this.persistence),
      jobId
    );

    if (this.playwrightOptions) {
      engines.push(new CrawlxPlaywrightEngine(this.playwrightOptions));
    }

    // Tandem path (preferred external backend)
    if (this.tandemOptions?.enabled && this.tandemOptions.resolveEligibility) {
      const eligibility = await this.tandemOptions.resolveEligibility(url);
      if (!eligibility.allowed) {
        if (eligibility.required) {
          return err(eligibility.error ?? 'Tandem is required for this domain, but the current worker is not authorized to use it');
        }
        // Not required — fall through to standard engines
      } else {
        const resolvedApiToken = eligibility.apiToken ?? this.tandemOptions.apiToken;
        const tandemEngine = new TandemBrowserEngine({
          ...this.tandemOptions,
          ...(eligibility.allowedDomains !== undefined ? { allowedDomains: eligibility.allowedDomains } : {}),
          ...(resolvedApiToken !== undefined ? { apiToken: resolvedApiToken } : {}),
        });

        if (eligibility.required) {
          return ok({ engines: [tandemEngine, manualReviewEngine] });
        }
        engines.push(tandemEngine);
        engines.push(manualReviewEngine);
        return ok({ engines });
      }
    }

    // Multilogin path (secondary external backend)
    if (!this.multiloginOptions?.enabled || !this.multiloginOptions.resolveEligibility) {
      engines.push(manualReviewEngine);
      return ok({ engines });
    }

    const eligibility = await this.multiloginOptions.resolveEligibility(url);
    if (!eligibility.allowed) {
      if (eligibility.required) {
        return err(eligibility.error ?? 'Multilogin is required for this domain, but the current worker is not authorized to use it');
      }
      engines.push(manualReviewEngine);
      return ok({ engines });
    }

    const allowedDomains = eligibility.allowedDomains ?? this.getAllowedDomains(url);
    const profileId = eligibility.profileId ?? this.multiloginOptions.profileId;
    const multiloginEngine = new MultiloginCdpEngine({
      ...this.multiloginOptions,
      allowedDomains,
      ...(profileId ? { profileId } : {}),
    });

    if (eligibility.required) {
      return ok({ engines: [multiloginEngine, manualReviewEngine] });
    }

    engines.push(multiloginEngine);
    engines.push(manualReviewEngine);
    return ok({ engines });
  }

  private getAllowedDomains(url: string): ReadonlyArray<string> {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return [hostname];
    } catch {
      return [];
    }
  }
}

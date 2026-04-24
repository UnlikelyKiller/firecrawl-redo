import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ok, err, Result, ResultAsync } from 'neverthrow';
import { FirecrawlClient } from '../../firecrawl-client/src';
import { ContentAddressedStore } from '../../artifact-store/src';
import { JobData, JobResult, JobType, JobStatus } from './types';
import { ScrapeRequest } from '../../firecrawl-compat/src';
import { JobPersistenceService } from './persistence';
import { WaterfallOrchestrator, CrawlEngine, EngineAttempt } from '../../waterfall-engine/src';
import { FirecrawlStaticEngine } from '../../waterfall-engine/src/engines/firecrawl-static';
import { FirecrawlJsEngine } from '../../waterfall-engine/src/engines/firecrawl-js';
import { CrawlxPlaywrightEngine, BrowserWorkerClientOptions } from '../../waterfall-engine/src/engines/crawlx-playwright';

export interface PlaywrightOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
}

export class ScrapeWorker {
  private readonly engines: CrawlEngine[];
  private worker: Worker<JobData, JobResult>;

  constructor(
    private readonly redisConnection: Redis,
    private readonly store: ContentAddressedStore,
    private readonly persistence: JobPersistenceService,
    client: FirecrawlClient,
    playwrightOptions?: PlaywrightOptions,
    queueName: string = 'scrape-queue'
  ) {
    this.engines = [
      new FirecrawlStaticEngine(client),
      new FirecrawlJsEngine(client),
    ];

    if (playwrightOptions) {
      this.engines.push(new CrawlxPlaywrightEngine(playwrightOptions));
    }

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

    await this.persistence.updateJobStatus(jobId, JobStatus.RUNNING);

    if (type !== JobType.SCRAPE) {
      const error = `Unsupported job type: ${type}`;
      await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, error);
      return { success: false, error };
    }

    const orchestrator = new WaterfallOrchestrator(
      this.engines,
      (attempt) => { this.recordAttempt(jobId, attempt); },
    );

    const scrapeResult = await orchestrator.scrape(payload as ScrapeRequest);

    if (scrapeResult.isErr()) {
      const error = scrapeResult.error.message;
      await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, error);
      return { success: false, error };
    }

    const data = scrapeResult.value.response;
    const artifacts: Array<{ hash: string; extension: string }> = [];

    let markdownHash: string | undefined;
    let rawHtmlHash: string | undefined;

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

      await this.persistence.savePage({
        jobId,
        canonicalUrl: payload.url,
        normalizedUrl: payload.url,
        statusCode: 200,
        contentType: 'text/html',
        markdownHash,
        rawHtmlHash,
      });
    }

    await this.persistence.updateJobStatus(jobId, JobStatus.COMPLETED);

    return {
      success: true,
      data: data,
      artifacts: artifacts,
    };
  }

  async close() {
    await this.worker.close();
  }
}
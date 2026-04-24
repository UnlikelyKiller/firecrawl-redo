import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ok, err, Result, ResultAsync } from 'neverthrow';
import { FirecrawlClient } from '../../firecrawl-client/src';
import { ContentAddressedStore } from '../../artifact-store/src';
import { JobData, JobResult, JobType, JobStatus } from './types';
import { ScrapeRequest } from '../../firecrawl-compat/src';
import { JobPersistenceService } from './persistence';

export class ScrapeWorker {
  private worker: Worker<JobData, JobResult>;

  constructor(
    private readonly redisConnection: Redis,
    private readonly client: FirecrawlClient,
    private readonly store: ContentAddressedStore,
    private readonly persistence: JobPersistenceService,
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

    const startTime = Date.now();
    const scrapeResult = await this.client.scrape(payload as ScrapeRequest);
    const latencyMs = Date.now() - startTime;
    
    if (scrapeResult.isErr()) {
      const error = scrapeResult.error.message;
      await this.persistence.recordEngineAttempt({
        jobId,
        engineName: 'firecrawl-oss',
        status: 'FAILED',
        error,
        latencyMs,
      });
      await this.persistence.updateJobStatus(jobId, JobStatus.FAILED, error);
      return { success: false, error };
    }

    await this.persistence.recordEngineAttempt({
      jobId,
      engineName: 'firecrawl-oss',
      status: 'COMPLETED',
      latencyMs,
    });

    const data = scrapeResult.value;
    const artifacts: Array<{ hash: string; extension: string }> = [];

    let markdownHash: string | undefined;
    let rawHtmlHash: string | undefined;

    // Store artifacts if available
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

      // Save page record
      await this.persistence.savePage({
        jobId,
        canonicalUrl: payload.url,
        normalizedUrl: payload.url,
        statusCode: 200, // Placeholder
        contentType: 'text/html', // Placeholder
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

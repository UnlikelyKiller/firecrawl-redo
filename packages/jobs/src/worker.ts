import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ok, err, Result, ResultAsync } from 'neverthrow';
import { FirecrawlClient } from '../../firecrawl-client/src';
import { ContentAddressedStore } from '../../artifact-store/src';
import { JobData, JobResult, JobType } from './types';
import { ScrapeRequest } from '../../firecrawl-compat/src';

export class ScrapeWorker {
  private worker: Worker<JobData, JobResult>;

  constructor(
    private readonly redisConnection: Redis,
    private readonly client: FirecrawlClient,
    private readonly store: ContentAddressedStore,
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

    if (type !== JobType.SCRAPE) {
      return { success: false, error: `Unsupported job type: ${type}` };
    }

    const scrapeResult = await this.client.scrape(payload as ScrapeRequest);
    
    if (scrapeResult.isErr()) {
      return { success: false, error: scrapeResult.error.message };
    }

    const data = scrapeResult.value;
    const artifacts: Array<{ hash: string; extension: string }> = [];

    // Store artifacts if available
    if (data.data) {
      if (data.data.markdown) {
        const hashResult = await this.store.store(data.data.markdown, 'md');
        if (hashResult.isOk()) {
          artifacts.push({ hash: hashResult.value, extension: 'md' });
          data.data.markdown = `hash:${hashResult.value}`; // Replace with pointer
        }
      }
      if (data.data.html) {
        const hashResult = await this.store.store(data.data.html, 'html');
        if (hashResult.isOk()) {
          artifacts.push({ hash: hashResult.value, extension: 'html' });
          data.data.html = `hash:${hashResult.value}`; // Replace with pointer
        }
      }
    }

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

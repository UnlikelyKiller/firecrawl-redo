import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ok, err, Result, ResultAsync } from 'neverthrow';
import { v7 as uuidv7 } from 'uuid';
import { 
  crawlJobs, 
  engineAttempts, 
  pages,
  manualReviews
} from '../../db/src';
import { JobType, JobStatus } from './types';

export class PersistenceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export class JobPersistenceService {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async createJob(data: {
    id: string;
    type: JobType;
    url: string;
    payload: any;
  }): Promise<Result<void, PersistenceError>> {
    try {
      await this.db.insert(crawlJobs).values({
        id: data.id,
        type: data.type,
        url: data.url,
        status: JobStatus.QUEUED,
        payload: data.payload,
      });
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('Failed to create job in DB', e));
    }
  }

  async updateJobStatus(id: string, status: JobStatus, error?: string): Promise<Result<void, PersistenceError>> {
    try {
      await this.db.update(crawlJobs)
        .set({ status, error: error ?? null })
        .where(eq(crawlJobs.id, id));
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError(`Failed to update job status for ${id}`, e));
    }
  }

  async recordEngineAttempt(data: {
    jobId: string;
    engineName: string;
    status: string;
    error?: string;
    latencyMs?: number;
  }): Promise<Result<string, PersistenceError>> {
    try {
      const result = await this.db.insert(engineAttempts).values({
        jobId: data.jobId,
        engineName: data.engineName,
        status: data.status,
        error: data.error ?? null,
        latencyMs: data.latencyMs ?? null,
      }).returning({ id: engineAttempts.id });
      
      return ok(result[0]?.id || '');
    } catch (e) {
      return err(new PersistenceError('Failed to record engine attempt', e));
    }
  }

  async savePage(data: {
    jobId: string;
    canonicalUrl: string;
    normalizedUrl: string;
    statusCode?: number | undefined;
    contentType?: string | undefined;
    markdownHash?: string | undefined;
    rawHtmlHash?: string | undefined;
    renderedHtmlHash?: string | undefined;
    screenshotHash?: string | undefined;
    metadataHash?: string | undefined;
  }): Promise<Result<void, PersistenceError>> {
    try {
      const values: any = {
        jobId: data.jobId,
        canonicalUrl: data.canonicalUrl,
        normalizedUrl: data.normalizedUrl,
        statusCode: data.statusCode ?? null,
        contentType: data.contentType ?? null,
        markdownHash: data.markdownHash ?? null,
        rawHtmlHash: data.rawHtmlHash ?? null,
        renderedHtmlHash: data.renderedHtmlHash ?? null,
        screenshotHash: data.screenshotHash ?? null,
        metadataHash: data.metadataHash ?? null,
      };

      await this.db.insert(pages).values(values);
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('Failed to save page to DB', e));
    }
  }

  async recordManualReview(data: {
    jobId?: string;
    url: string;
    reason?: string;
    metadata?: any;
  }): Promise<Result<void, PersistenceError>> {
    try {
      await this.db.insert(manualReviews).values({
        jobId: data.jobId ?? null,
        url: data.url,
        status: 'pending',
        reason: data.reason ?? null,
        metadata: data.metadata ?? null,
        updatedAt: new Date(),
      });
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('Failed to record manual review', e));
    }
  }
}

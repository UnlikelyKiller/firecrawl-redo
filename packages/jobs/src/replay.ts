import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Queue } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { ok, err, Result } from 'neverthrow';
import { crawlJobs } from '../../db/src';
import { JobData, JobType, JobStatus } from './types';
import { PersistenceError } from './persistence';

export class JobReplayService {
  constructor(
    private readonly db: PostgresJsDatabase<any>,
    private readonly queue: Queue<JobData>
  ) {}

  async replay(jobId: string): Promise<Result<string, PersistenceError>> {
    try {
      const results = await this.db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId)).limit(1);
      const originalJob = results[0];

      if (!originalJob) {
        return err(new PersistenceError(`Job ${jobId} not found for replay`));
      }

      const newJobId = uuidv7();
      
      // Persist the new job record
      await this.db.insert(crawlJobs).values({
        id: newJobId,
        type: originalJob.type,
        url: originalJob.url,
        status: JobStatus.QUEUED,
        payload: originalJob.payload,
      });

      // Add to BullMQ
      await this.queue.add(originalJob.type.toLowerCase(), {
        type: originalJob.type as JobType,
        payload: originalJob.payload as any,
        createdAt: Date.now(),
      }, { jobId: newJobId });

      return ok(newJobId);
    } catch (e) {
      return err(new PersistenceError(`Failed to replay job ${jobId}`, e));
    }
  }
}

import express from 'express';
import { Queue } from 'bullmq';
import { IORedis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';
import { 
  ScrapeRequestSchema, 
  CrawlRequestSchema 
} from '../../../../../packages/firecrawl-compat/src';
import { JobType, JobData } from '../../../../../packages/jobs/src';

export const crawlXV2Router = express.Router();

// Initialize Redis connection (should be shared in a real app)
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const scrapeQueue = new Queue<JobData>('scrape-queue', { connection });

crawlXV2Router.post('/scrape', async (req, res) => {
  const result = ScrapeRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  const jobId = uuidv7();
  await scrapeQueue.add('scrape', {
    type: JobType.SCRAPE,
    payload: result.data,
    createdAt: Date.now(),
  }, { jobId });

  return res.json({
    success: true,
    jobId: jobId,
  });
});

crawlXV2Router.post('/crawl', async (req, res) => {
  const result = CrawlRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  const jobId = uuidv7();
  await scrapeQueue.add('crawl', {
    type: JobType.CRAWL,
    payload: result.data,
    createdAt: Date.now(),
  }, { jobId });

  return res.json({
    success: true,
    jobId: jobId,
  });
});

crawlXV2Router.get('/status/:jobId', async (req, res) => {
  const job = await scrapeQueue.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  const state = await job.getState();
  return res.json({
    success: true,
    jobId: job.id,
    state: state,
    data: job.data,
    result: job.returnvalue,
  });
});

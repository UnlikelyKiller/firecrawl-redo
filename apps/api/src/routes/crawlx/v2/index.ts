import express from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';
import { 
  ScrapeRequestSchema, 
  CrawlRequestSchema 
} from '../../../../../packages/firecrawl-compat/src';
import { JobType, JobData, JobReplayService } from '../../../../../packages/jobs/src';
import { ContentAddressedStore } from '../../../../../packages/artifact-store/src';
import path from 'path';

export const crawlXV2Router = express.Router();

// Initialize Redis connection (should be shared in a real app)
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const scrapeQueue = new Queue<JobData>('scrape-queue', { connection });
const store = new ContentAddressedStore(path.join(process.cwd(), 'data/artifacts'));

// Assuming DB is initialized elsewhere, placeholder for now
// In a real app, this would be injected
const db: any = {}; 
const replayService = new JobReplayService(db, scrapeQueue);

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

crawlXV2Router.get('/artifacts/:hash', async (req, res) => {
  const ext = (req.query.ext as string) || 'md';
  const result = await store.retrieve(req.params.hash, ext);

  if (result.isErr()) {
    return res.status(404).json({ success: false, error: 'Artifact not found' });
  }

  res.setHeader('Content-Type', ext === 'html' ? 'text/html' : 'text/markdown');
  return res.send(result.value);
});

crawlXV2Router.post('/replay/:jobId', async (req, res) => {
  const result = await replayService.replay(req.params.jobId);
  
  if (result.isErr()) {
    return res.status(400).json({ success: false, error: result.error.message });
  }

  return res.json({
    success: true,
    newJobId: result.value,
  });
});

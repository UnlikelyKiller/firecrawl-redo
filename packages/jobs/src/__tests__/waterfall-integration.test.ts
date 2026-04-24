import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err, ResultAsync, errAsync } from 'neverthrow';
import { ScrapeWorker } from '../worker';
import { JobPersistenceService, PersistenceError } from '../persistence';
import { ContentAddressedStore } from '../../../artifact-store/src';
import { FirecrawlClient, FirecrawlClientError } from '../../../firecrawl-client/src';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';
import { JobType, JobStatus, JobData, JobResult } from '../types';

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn().mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const fakeResponse: ScrapeResponse = {
  success: true,
  data: { markdown: '# Hello', html: '<h1>Hello</h1>' },
};

function createMockClient(response: ResultAsync<ScrapeResponse, FirecrawlClientError>): FirecrawlClient {
  return {
    scrape: vi.fn().mockReturnValue(response),
  } as unknown as FirecrawlClient;
}

function createMockStore(): ContentAddressedStore {
  return {
    store: vi.fn().mockResolvedValue(ok('deadbeef')),
  } as unknown as ContentAddressedStore;
}

interface RecordedAttempt {
  jobId: string;
  engineName: string;
  status: string;
  error?: string;
  latencyMs?: number;
}

function createMockPersistence() {
  const attempts: RecordedAttempt[] = [];
  const statusUpdates: Array<{ id: string; status: JobStatus; error?: string }> = [];

  const recordEngineAttemptFn = vi.fn().mockImplementation(async (data: RecordedAttempt) => {
    attempts.push(data);
    return ok('attempt-id');
  });

  const service = {
    updateJobStatus: vi.fn().mockImplementation(async (id: string, status: JobStatus, error?: string) => {
      if (error !== undefined) {
        statusUpdates.push({ id, status, error });
      } else {
        statusUpdates.push({ id, status });
      }
      return ok(undefined);
    }),
    recordEngineAttempt: recordEngineAttemptFn,
    savePage: vi.fn().mockResolvedValue(ok(undefined)),
    createJob: vi.fn().mockResolvedValue(ok(undefined)),
  } as unknown as JobPersistenceService;

  return { attempts, statusUpdates, service, recordEngineAttemptFn };
}

function createMockRedis(): any {
  return {};
}

async function runProcessJob(worker: ScrapeWorker, jobData: JobData, jobId: string = 'test-job-1') {
  const mockJob = {
    id: jobId,
    data: jobData,
  } as unknown as import('bullmq').Job<JobData, JobResult>;

  const processJob = (worker as any).processJob.bind(worker);
  return processJob(mockJob);
}

describe('ScrapeWorker with WaterfallOrchestrator', () => {
  let mockRedis: any;
  let mockStore: ContentAddressedStore;
  let mockPersistence: ReturnType<typeof createMockPersistence>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockStore = createMockStore();
    mockPersistence = createMockPersistence();
  });

  it('static engine succeeds without fallback', async () => {
    const client = createMockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(true);

    const engineAttempts = mockPersistence.attempts.filter(a => a.jobId === 'test-job-1');
    const completedAttempts = engineAttempts.filter(a => a.status === 'COMPLETED');
    expect(completedAttempts.length).toBeGreaterThanOrEqual(1);
    expect(completedAttempts.some(a => a.engineName === 'firecrawl-static')).toBe(true);
  });

  it('static fails then JS fallback succeeds', async () => {
    const clientError = new FirecrawlClientError('Static engine down');
    const client = {
      scrape: vi.fn()
        .mockReturnValueOnce(errAsync(clientError))
        .mockReturnValueOnce(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse))),
    } as unknown as FirecrawlClient;

    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(true);

    const engineAttempts = mockPersistence.attempts.filter(a => a.jobId === 'test-job-1');
    const failedAttempts = engineAttempts.filter(a => a.status === 'FAILED');
    const completedAttempts = engineAttempts.filter(a => a.status === 'COMPLETED');
    expect(failedAttempts.some(a => a.engineName === 'firecrawl-static')).toBe(true);
    expect(completedAttempts.some(a => a.engineName === 'firecrawl-js')).toBe(true);
  });

  it('all engines fail marks job FAILED', async () => {
    const clientError = new FirecrawlClientError('All engines down');
    const client = createMockClient(errAsync(clientError));

    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(false);

    const failedUpdate = mockPersistence.statusUpdates.find(u => u.status === JobStatus.FAILED);
    expect(failedUpdate).toBeDefined();
  });

  it('engine attempts are recorded in persistence', async () => {
    const client = createMockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
    );

    await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(mockPersistence.recordEngineAttemptFn).toHaveBeenCalled();
    const calls = mockPersistence.recordEngineAttemptFn.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const firstCall = calls[0]![0] as RecordedAttempt;
    expect(firstCall.engineName).toBe('firecrawl-static');
    expect(firstCall.status).toBe('COMPLETED');
  });
});
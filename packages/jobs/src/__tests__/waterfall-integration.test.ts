import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const mockPage = {
  goto: vi.fn(),
  waitForLoadState: vi.fn(),
  content: vi.fn(),
  locator: vi.fn(),
  title: vi.fn(),
  url: vi.fn(),
};
const mockContext = {
  pages: vi.fn(),
  newPage: vi.fn(),
};
const mockBrowser = {
  contexts: vi.fn(),
  newContext: vi.fn(),
  close: vi.fn(),
};
const connectOverCDP = vi.fn();

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

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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

  it('uses Multilogin as the only engine when the domain requires it', async () => {
    const client = createMockClient(errAsync(new FirecrawlClientError('should not be used')));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaseId: 'lease-123',
          profileId: 'profile-123',
          cdpUrl: 'http://bridge.local/cdp/lease-123',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ released: true }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('Hello') });
    mockPage.title.mockResolvedValue('Example');
    mockPage.url.mockReturnValue('https://example.com');
    mockContext.pages.mockReturnValue([mockPage]);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
      undefined,
      {
        enabled: true,
        baseUrl: 'http://multilogin-bridge.local',
        profileId: 'profile-123',
        apiToken: 'secret',
        connectOverCdp: connectOverCDP,
        resolveEligibility: async () => ({
          allowed: true,
          required: true,
          allowedDomains: ['example.com'],
        }),
      },
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(true);
    const engineAttempts = mockPersistence.attempts.filter(a => a.jobId === 'test-job-1');
    expect(engineAttempts.some(a => a.engineName === 'multilogin-cdp' && a.status === 'COMPLETED')).toBe(true);
    expect(engineAttempts.some(a => a.engineName === 'firecrawl-static')).toBe(false);
  });

  it('fails the job when Multilogin is required but not authorized', async () => {
    const client = createMockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
      undefined,
      {
        enabled: true,
        baseUrl: 'http://multilogin-bridge.local',
        profileId: 'profile-123',
        apiToken: 'secret',
        resolveEligibility: async () => ({
          allowed: false,
          required: true,
        }),
      },
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(false);
    const failedUpdate = mockPersistence.statusUpdates.find(u => u.status === JobStatus.FAILED);
    expect(failedUpdate?.error).toContain('Multilogin is required');
  });

  it('marks the job failed when Multilogin eligibility resolution throws', async () => {
    const client = createMockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
      undefined,
      {
        enabled: true,
        baseUrl: 'http://multilogin-bridge.local',
        profileId: 'profile-123',
        apiToken: 'secret',
        resolveEligibility: async () => {
          throw new Error('eligibility lookup failed');
        },
      },
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(false);
    const failedUpdate = mockPersistence.statusUpdates.find(u => u.status === JobStatus.FAILED);
    expect(failedUpdate?.error).toContain('eligibility lookup failed');
  });

  it('uses the profileId returned by eligibility resolution', async () => {
    const client = createMockClient(errAsync(new FirecrawlClientError('should not be used')));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaseId: 'lease-123',
          profileId: 'profile-override',
          wsEndpoint: 'ws://bridge.local/cdp/lease-123/ws',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          leaseId: 'lease-123',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ released: true }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('Hello') });
    mockPage.title.mockResolvedValue('Example');
    mockPage.url.mockReturnValue('https://example.com');
    mockContext.pages.mockReturnValue([mockPage]);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const scrapeWorker = new ScrapeWorker(
      mockRedis,
      mockStore,
      mockPersistence.service,
      client,
      undefined,
      {
        enabled: true,
        baseUrl: 'http://multilogin-bridge.local',
        profileId: 'global-profile',
        apiToken: 'secret',
        connectOverCdp: connectOverCDP,
        resolveEligibility: async () => ({
          allowed: true,
          required: true,
          allowedDomains: ['example.com'],
          profileId: 'profile-override',
        }),
      },
    );

    const result = await runProcessJob(scrapeWorker, {
      type: JobType.SCRAPE,
      payload: fakeRequest,
      createdAt: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('profile-override');
  });
});

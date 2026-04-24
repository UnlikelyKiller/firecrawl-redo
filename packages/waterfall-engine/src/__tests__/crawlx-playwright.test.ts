import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrawlxPlaywrightEngine } from '../engines/crawlx-playwright';
import { ScrapeRequest } from '../../../firecrawl-compat/src';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const successBody = {
  success: true,
  hashes: {
    renderedHtml: 'abc123',
    visibleText: 'def456',
    screenshotFull: 'ghi789',
  },
  statusCode: 200,
  url: 'https://example.com',
  title: 'Example',
  engineName: 'browser-worker',
};

const emptyBody = {
  success: true,
  hashes: {},
  statusCode: 200,
  url: 'https://example.com',
  title: '',
  engineName: 'browser-worker',
};

function mockFetchSuccess(body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }));
}

function mockFetchHttpError(status: number, body?: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body ?? { success: false, error: 'Internal error' }),
  }));
}

function mockFetchError(error: Error): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

describe('CrawlxPlaywrightEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ScrapeResponse on successful browser worker response', async () => {
    mockFetchSuccess(successBody);
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.success).toBe(true);
      expect(result.value.data).toBeDefined();
      expect(result.value.data?.markdown).toBe('hash:def456');
      expect(result.value.data?.html).toBe('hash:abc123');
    }
  });

  it('returns TIMEOUT on request timeout', async () => {
    mockFetchError(new DOMException('The operation was aborted', 'AbortError'));

    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.engineName).toBe('crawlx-playwright');
    }
  });

  it('returns UPSTREAM_DOWN on connection refused', async () => {
    mockFetchError(new TypeError('fetch failed: ECONNREFUSED'));
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.engineName).toBe('crawlx-playwright');
    }
  });

  it('returns CONTENT_EMPTY on empty response from browser worker', async () => {
    mockFetchSuccess(emptyBody);
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONTENT_EMPTY');
      expect(result.error.engineName).toBe('crawlx-playwright');
    }
  });

  it('supports() returns true', () => {
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });
    expect(engine.supports(fakeRequest)).toBe(true);
  });

  it('priority is 30', () => {
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });
    expect(engine.priority).toBe(30);
  });

  it('returns UPSTREAM_DOWN on HTTP error from browser worker', async () => {
    mockFetchHttpError(500);
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.engineName).toBe('crawlx-playwright');
    }
  });

  it('returns UPSTREAM_DOWN when browser worker returns success: false', async () => {
    mockFetchSuccess({
      success: false,
      statusCode: 500,
      url: 'https://example.com',
      title: '',
      engineName: 'browser-worker',
      error: 'Navigation failed',
    });
    const engine = new CrawlxPlaywrightEngine({ baseUrl: 'http://localhost:3100' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.message).toContain('Navigation failed');
    }
  });
});
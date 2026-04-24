import { describe, it, expect, vi } from 'vitest';
import { ok, err, errAsync, ResultAsync } from 'neverthrow';
import { FirecrawlStaticEngine } from '../engines/firecrawl-static';
import { FirecrawlJsEngine } from '../engines/firecrawl-js';
import { FirecrawlClient, FirecrawlClientError } from '../../../firecrawl-client/src';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const fakeResponse: ScrapeResponse = {
  success: true,
  data: { markdown: '# Hello', html: '<h1>Hello</h1>' },
};

const emptyResponse: ScrapeResponse = {
  success: true,
  data: {},
};

function mockClient(response: ResultAsync<ScrapeResponse, FirecrawlClientError>): FirecrawlClient {
  return {
    scrape: vi.fn().mockReturnValue(response),
  } as unknown as FirecrawlClient;
}

describe('FirecrawlStaticEngine', () => {
  it('returns ScrapeResponse on success', async () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlStaticEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(fakeResponse);
    }
  });

  it('returns CONTENT_EMPTY on empty response', async () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(emptyResponse)));
    const engine = new FirecrawlStaticEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONTENT_EMPTY');
      expect(result.error.engineName).toBe('firecrawl-static');
    }
  });

  it('returns UPSTREAM_DOWN on client error', async () => {
    const clientError = new FirecrawlClientError('Connection refused');
    const client = mockClient(errAsync(clientError));
    const engine = new FirecrawlStaticEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.engineName).toBe('firecrawl-static');
    }
  });

  it('supports() always returns true', () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlStaticEngine(client);

    expect(engine.supports(fakeRequest)).toBe(true);
  });

  it('has priority 10', () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlStaticEngine(client);

    expect(engine.priority).toBe(10);
  });
});

describe('FirecrawlJsEngine', () => {
  it('returns ScrapeResponse on success', async () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlJsEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(fakeResponse);
    }
  });

  it('returns CONTENT_EMPTY on empty response', async () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(emptyResponse)));
    const engine = new FirecrawlJsEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONTENT_EMPTY');
      expect(result.error.engineName).toBe('firecrawl-js');
    }
  });

  it('returns UPSTREAM_DOWN on client error', async () => {
    const clientError = new FirecrawlClientError('Connection refused');
    const client = mockClient(errAsync(clientError));
    const engine = new FirecrawlJsEngine(client);

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.engineName).toBe('firecrawl-js');
    }
  });

  it('supports() always returns true', () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlJsEngine(client);

    expect(engine.supports(fakeRequest)).toBe(true);
  });

  it('has priority 20', () => {
    const client = mockClient(ResultAsync.fromSafePromise(Promise.resolve(fakeResponse)));
    const engine = new FirecrawlJsEngine(client);

    expect(engine.priority).toBe(20);
  });
});
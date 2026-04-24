import { describe, it, expect, vi } from 'vitest';
import { ManualSeedProvider } from '../manual-seeds.js';
import { SearXNGProvider } from '../searxng.js';
import type { SearchResult } from '../provider.js';

describe('SearXNGProvider', () => {
  it('returns results on success', async () => {
    const mockResults = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', score: 1.5 },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ results: mockResults, number_of_results: 2 }),
      ok: true,
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new SearXNGProvider('http://localhost:8080');
    const result = await provider.search('test query');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.results).toHaveLength(2);
      expect(result.value.results[0]?.title).toBe('Result 1');
      expect(result.value.results[0]?.relevanceScore).toBe(1.5);
      expect(result.value.results[1]?.title).toBe('Result 2');
      expect(result.value.totalResults).toBe(2);
    }

    vi.restoreAllMocks();
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const provider = new SearXNGProvider('http://localhost:8080');
    const result = await provider.search('test query');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(result.error.provider).toBe('searxng');
    }

    vi.restoreAllMocks();
  });

  it('returns INVALID_QUERY for empty query', async () => {
    const provider = new SearXNGProvider('http://localhost:8080');
    const result = await provider.search('   ');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_QUERY');
    }
  });

  it('returns NO_RESULTS when SearXNG returns empty results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ results: [] }),
      ok: true,
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new SearXNGProvider('http://localhost:8080');
    const result = await provider.search('obscure query');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NO_RESULTS');
    }

    vi.restoreAllMocks();
  });
});

describe('ManualSeedProvider', () => {
  const seedResults: ReadonlyArray<SearchResult> = [
    { title: 'Seeded Result', url: 'https://seed.example.com', snippet: 'Seeded snippet', relevanceScore: 0.9 },
  ];

  it('returns pre-configured results', async () => {
    const provider = new ManualSeedProvider({ 'test query': seedResults });
    const result = await provider.search('test query');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.results).toHaveLength(1);
      expect(result.value.results[0]?.title).toBe('Seeded Result');
    }
  });

  it('returns NO_RESULTS for unknown query', async () => {
    const provider = new ManualSeedProvider({ 'test query': seedResults });
    const result = await provider.search('unknown query');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NO_RESULTS');
      expect(result.error.provider).toBe('manual-seeds');
    }
  });

  it('normalizes query to lowercase for matching', async () => {
    const provider = new ManualSeedProvider({ 'test query': seedResults });
    const result = await provider.search('TEST QUERY');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.results).toHaveLength(1);
    }
  });
});

describe('SearchProvider interface contract', () => {
  it('all providers return ResultAsync', () => {
    const provider = new ManualSeedProvider({ test: [{ title: 'A', url: 'https://a.com', snippet: 's' }] });

    const result = provider.search('test');
    expect(typeof result.then).toBe('function');
  });
});
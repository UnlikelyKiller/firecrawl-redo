import { describe, it, expect, vi } from 'vitest';
import { Result, ok, err } from 'neverthrow';
import { WaterfallOrchestrator } from '../orchestrator';
import { CrawlEngine, CrawlFailure } from '../engine';
import { ScrapeRequest, ScrapeResponse } from '../../../firecrawl-compat/src';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const fakeResponse: ScrapeResponse = {
  success: true,
  data: { markdown: '# Hello' },
};

function createMockEngine(
  name: string,
  priority: number,
  shouldSupport: boolean,
  result: Result<ScrapeResponse, CrawlFailure>,
  delayMs = 0,
): CrawlEngine {
  return {
    name,
    priority,
    supports: vi.fn().mockReturnValue(shouldSupport),
    scrape: vi.fn().mockImplementation(async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      return result;
    }),
  };
}

describe('WaterfallOrchestrator', () => {
  it('returns success from the first engine that succeeds', async () => {
    const engine = createMockEngine('a', 10, true, ok(fakeResponse));
    const orchestrator = new WaterfallOrchestrator([engine]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.engineUsed).toBe('a');
      expect(result.value.response).toEqual(fakeResponse);
      expect(result.value.attempts).toHaveLength(1);
      expect(result.value.attempts[0]!.success).toBe(true);
    }
  });

  it('falls back to the second engine when the first fails', async () => {
    const failure: CrawlFailure = {
      code: 'UPSTREAM_DOWN',
      message: 'fail',
      engineName: 'a',
    };
    const engineA = createMockEngine('a', 10, true, err(failure));
    const engineB = createMockEngine('b', 20, true, ok(fakeResponse));
    const orchestrator = new WaterfallOrchestrator([engineA, engineB]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.engineUsed).toBe('b');
      expect(result.value.attempts).toHaveLength(2);
      expect(result.value.attempts[0]!.success).toBe(false);
      expect(result.value.attempts[1]!.success).toBe(true);
    }
  });

  it('returns the last failure when all engines fail', async () => {
    const failureA: CrawlFailure = { code: 'UPSTREAM_DOWN', message: 'a-fail', engineName: 'a' };
    const failureB: CrawlFailure = { code: 'TIMEOUT', message: 'b-fail', engineName: 'b' };
    const engineA = createMockEngine('a', 10, true, err(failureA));
    const engineB = createMockEngine('b', 20, true, err(failureB));
    const orchestrator = new WaterfallOrchestrator([engineA, engineB]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.message).toBe('b-fail');
    }
  });

  it('skips engines that do not support the request', async () => {
    const engineA = createMockEngine('a', 10, false, err({ code: 'UNKNOWN', message: 'nope', engineName: 'a' }));
    const engineB = createMockEngine('b', 20, true, ok(fakeResponse));
    const orchestrator = new WaterfallOrchestrator([engineA, engineB]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    expect(engineA.scrape).not.toHaveBeenCalled();
    expect(engineB.scrape).toHaveBeenCalled();
  });

  it('sorts engines by priority ascending before iterating', async () => {
    const engineC = createMockEngine('c', 30, true, err({ code: 'UNKNOWN', message: 'c-fail', engineName: 'c' }));
    const engineA = createMockEngine('a', 10, true, ok(fakeResponse));
    const engineB = createMockEngine('b', 20, true, ok(fakeResponse));
    const orchestrator = new WaterfallOrchestrator([engineC, engineA, engineB]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.engineUsed).toBe('a');
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it('calls onAttempt callback for each engine attempt', async () => {
    const failure: CrawlFailure = { code: 'UPSTREAM_DOWN', message: 'fail', engineName: 'a' };
    const engineA = createMockEngine('a', 10, true, err(failure));
    const engineB = createMockEngine('b', 20, true, ok(fakeResponse));
    const onAttempt = vi.fn();
    const orchestrator = new WaterfallOrchestrator([engineA, engineB], onAttempt);

    await orchestrator.scrape(fakeRequest);

    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ engineName: 'a', success: false }),
    );
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ engineName: 'b', success: true }),
    );
  });

  it('returns UNKNOWN error when no engines are provided', async () => {
    const orchestrator = new WaterfallOrchestrator([]);

    const result = await orchestrator.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UNKNOWN');
      expect(result.error.engineName).toBe('waterfall-orchestrator');
    }
  });
});
import { describe, it, expect } from 'vitest';
import { UsageMeter, DEFAULT_COST_RATES } from '../meter.js';
import type { UsageEntry, CostRates } from '../meter.js';

function makeEntry(overrides: Partial<Omit<UsageEntry, 'estimatedCostUsd'>> = {}): Omit<UsageEntry, 'estimatedCostUsd'> {
  return {
    jobId: 'job-001',
    timestamp: new Date('2025-01-15T10:00:00Z'),
    llmTokensIn: 0,
    llmTokensOut: 0,
    browserSeconds: 0,
    pagesScraped: 0,
    ...overrides,
  };
}

describe('UsageMeter', () => {
  const meter = new UsageMeter();

  it('calculates cost with LLM tokens only', () => {
    const result = meter.calculateCost(makeEntry({ llmTokensIn: 1000, llmTokensOut: 500 }));
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    const expectedLlmIn = (1000 / 1000) * DEFAULT_COST_RATES.llmTokenInPer1k;
    const expectedLlmOut = (500 / 1000) * DEFAULT_COST_RATES.llmTokenOutPer1k;
    expect(entry.estimatedCostUsd).toBe(Math.round((expectedLlmIn + expectedLlmOut) * 100000) / 100000);
  });

  it('calculates cost with browser seconds only', () => {
    const result = meter.calculateCost(makeEntry({ browserSeconds: 30 }));
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    expect(entry.estimatedCostUsd).toBe(Math.round(30 * DEFAULT_COST_RATES.browserSecondPer * 100000) / 100000);
  });

  it('calculates cost with pages only', () => {
    const result = meter.calculateCost(makeEntry({ pagesScraped: 100 }));
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    expect(entry.estimatedCostUsd).toBe(Math.round(100 * DEFAULT_COST_RATES.pageScrapePer * 100000) / 100000);
  });

  it('calculates cost with all components', () => {
    const result = meter.calculateCost(
      makeEntry({ llmTokensIn: 2000, llmTokensOut: 1000, browserSeconds: 60, pagesScraped: 50 }),
    );
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    const llmCost = (2000 / 1000) * DEFAULT_COST_RATES.llmTokenInPer1k + (1000 / 1000) * DEFAULT_COST_RATES.llmTokenOutPer1k;
    const browserCost = 60 * DEFAULT_COST_RATES.browserSecondPer;
    const pageCost = 50 * DEFAULT_COST_RATES.pageScrapePer;
    const expected = Math.round((llmCost + browserCost + pageCost) * 100000) / 100000;
    expect(entry.estimatedCostUsd).toBe(expected);
  });

  it('rounds cost to 5 decimal places', () => {
    const result = meter.calculateCost(makeEntry({ llmTokensIn: 3333 }));
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    const costStr = entry.estimatedCostUsd.toString();
    const decimalPart = costStr.split('.')[1];
    if (decimalPart) {
      expect(decimalPart.length).toBeLessThanOrEqual(5);
    }
  });

  it('aggregate daily summary from multiple entries', () => {
    const entries: UsageEntry[] = [
      { ...makeEntry({ jobId: 'job-1' }), estimatedCostUsd: 0.0004 },
      { ...makeEntry({ jobId: 'job-2', llmTokensIn: 500 }), estimatedCostUsd: 0.00005 },
      { ...makeEntry({ jobId: 'job-3', pagesScraped: 10 }), estimatedCostUsd: 0.001 },
    ];

    const summary = meter.aggregateDaily(entries);
    expect(summary.jobCount).toBe(3);
    expect(summary.date).toBe('2025-01-15');
  });

  it('zero usage produces zero cost', () => {
    const result = meter.calculateCost(makeEntry());
    expect(result.isOk()).toBe(true);
    const entry = result._unsafeUnwrap();
    expect(entry.estimatedCostUsd).toBe(0);
  });
});
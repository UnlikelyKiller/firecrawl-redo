import { Result, ok, err } from 'neverthrow';

export interface UsageEntry {
  readonly jobId: string;
  readonly timestamp: Date;
  readonly llmTokensIn: number;
  readonly llmTokensOut: number;
  readonly browserSeconds: number;
  readonly pagesScraped: number;
  readonly estimatedCostUsd: number;
}

export interface CostRates {
  readonly llmTokenInPer1k: number;
  readonly llmTokenOutPer1k: number;
  readonly browserSecondPer: number;
  readonly pageScrapePer: number;
}

export const DEFAULT_COST_RATES: CostRates = {
  llmTokenInPer1k: 0.0001,
  llmTokenOutPer1k: 0.0003,
  browserSecondPer: 0.001,
  pageScrapePer: 0.0001,
};

export interface DailyUsageSummary {
  readonly date: string;
  readonly totalLlmTokensIn: number;
  readonly totalLlmTokensOut: number;
  readonly totalBrowserSeconds: number;
  readonly totalPagesScraped: number;
  readonly totalCostUsd: number;
  readonly jobCount: number;
}

export class UsageMeter {
  constructor(private readonly rates: CostRates = DEFAULT_COST_RATES) {}

  calculateCost(entry: Omit<UsageEntry, 'estimatedCostUsd'>): Result<UsageEntry, Error> {
    const llmCost =
      (entry.llmTokensIn / 1000) * this.rates.llmTokenInPer1k +
      (entry.llmTokensOut / 1000) * this.rates.llmTokenOutPer1k;
    const browserCost = entry.browserSeconds * this.rates.browserSecondPer;
    const pageCost = entry.pagesScraped * this.rates.pageScrapePer;
    const totalCost = llmCost + browserCost + pageCost;

    return ok({
      ...entry,
      estimatedCostUsd: Math.round(totalCost * 100000) / 100000,
    });
  }

  aggregateDaily(entries: ReadonlyArray<UsageEntry>): DailyUsageSummary {
    if (entries.length === 0) {
      return {
        date: new Date().toISOString().slice(0, 10),
        totalLlmTokensIn: 0,
        totalLlmTokensOut: 0,
        totalBrowserSeconds: 0,
        totalPagesScraped: 0,
        totalCostUsd: 0,
        jobCount: 0,
      };
    }

    const first = entries[0]!;
    const date = first.timestamp.toISOString().slice(0, 10);

    return entries.reduce(
      (acc, entry) => ({
        date,
        totalLlmTokensIn: acc.totalLlmTokensIn + entry.llmTokensIn,
        totalLlmTokensOut: acc.totalLlmTokensOut + entry.llmTokensOut,
        totalBrowserSeconds: acc.totalBrowserSeconds + entry.browserSeconds,
        totalPagesScraped: acc.totalPagesScraped + entry.pagesScraped,
        totalCostUsd: Math.round((acc.totalCostUsd + entry.estimatedCostUsd) * 100000) / 100000,
        jobCount: acc.jobCount + 1,
      }),
      {
        date,
        totalLlmTokensIn: 0,
        totalLlmTokensOut: 0,
        totalBrowserSeconds: 0,
        totalPagesScraped: 0,
        totalCostUsd: 0,
        jobCount: 0,
      },
    );
  }
}
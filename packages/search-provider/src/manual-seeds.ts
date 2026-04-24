import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { SearchProvider, SearchResponse, SearchResult, SearchError } from './provider.js';

export class ManualSeedProvider implements SearchProvider {
  readonly name = 'manual-seeds';
  private readonly seeds: ReadonlyMap<string, ReadonlyArray<SearchResult>>;

  constructor(seeds: Record<string, ReadonlyArray<SearchResult>>) {
    this.seeds = new Map(Object.entries(seeds));
  }

  search(query: string, _limit?: number): ResultAsync<SearchResponse, SearchError> {
    const normalizedQuery = query.trim().toLowerCase();
    const results = this.seeds.get(normalizedQuery);

    if (!results || results.length === 0) {
      return errAsync<SearchResponse, SearchError>({
        code: 'NO_RESULTS',
        message: `No seeded results for query: ${query}`,
        provider: this.name,
      });
    }

    return okAsync<SearchResponse, SearchError>({
      results,
      query,
    });
  }
}
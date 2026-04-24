import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { SearchProvider, SearchResponse, SearchResult, SearchError } from './provider.js';

interface SearXNGResult {
  readonly title?: string;
  readonly url?: string;
  readonly snippet?: string;
  readonly score?: number;
}

interface SearXNGResponse {
  readonly results?: ReadonlyArray<SearXNGResult>;
  readonly number_of_results?: number;
}

export class SearXNGProvider implements SearchProvider {
  readonly name = 'searxng';

  constructor(private readonly baseUrl: string) {}

  search(query: string, limit: number = 10): ResultAsync<SearchResponse, SearchError> {
    if (!query.trim()) {
      return errAsync<SearchResponse, SearchError>({
        code: 'INVALID_QUERY',
        message: 'Query must not be empty',
        provider: this.name,
      });
    }

    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`;

    return ResultAsync.fromPromise(
      fetch(url).then(res => res.json() as Promise<SearXNGResponse>),
      (e): SearchError => ({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Failed to reach SearXNG instance',
        provider: this.name,
        cause: e,
      }),
    ).andThen((body) => {
      const raw = body.results ?? [];
      const results: SearchResult[] = raw
        .filter((r): r is SearXNGResult & { title: string; url: string } =>
          typeof r.title === 'string' && typeof r.url === 'string',
        )
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: typeof r.snippet === 'string' ? r.snippet : '',
          ...(typeof r.score === 'number' ? { relevanceScore: r.score } : {}),
        }));

      if (results.length === 0) {
        return errAsync<SearchResponse, SearchError>({
          code: 'NO_RESULTS',
          message: 'No results found for query',
          provider: this.name,
        });
      }

      return okAsync<SearchResponse, SearchError>({
        results,
        query,
        ...(typeof body.number_of_results === 'number' ? { totalResults: body.number_of_results } : {}),
      });
    });
  }
}
import { ResultAsync } from 'neverthrow';

export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly relevanceScore?: number;
}

export interface SearchResponse {
  readonly results: ReadonlyArray<SearchResult>;
  readonly query: string;
  readonly totalResults?: number;
}

export interface SearchError {
  readonly code: 'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_QUERY' | 'NO_RESULTS' | 'UNKNOWN';
  readonly message: string;
  readonly provider: string;
  readonly cause?: unknown;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): ResultAsync<SearchResponse, SearchError>;
}
import { fetch, Response, RequestInit } from 'undici';
import { ok, err, Result, ResultAsync } from 'neverthrow';
import CircuitBreaker from 'opossum';
import { 
  ScrapeRequest, 
  ScrapeResponse, 
  ScrapeResponseSchema 
} from '../../firecrawl-compat/src';

export class FirecrawlClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FirecrawlClientError';
  }
}

export interface FirecrawlClientOptions {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly circuitBreakerOptions?: CircuitBreaker.Options;
}

export class FirecrawlClient {
  private readonly breaker: CircuitBreaker<[string, RequestInit], Response>;

  constructor(private readonly options: FirecrawlClientOptions) {
    const fetchWithTimeout = async (url: string, init: RequestInit): Promise<Response> => {
      const response = await fetch(url, init);
      return response as Response;
    };

    this.breaker = new CircuitBreaker(fetchWithTimeout, {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      ...options.circuitBreakerOptions,
    });
  }

  scrape(request: ScrapeRequest): ResultAsync<ScrapeResponse, FirecrawlClientError> {
    const url = `${this.options.baseUrl}/v1/scrape`;
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
    };

    return ResultAsync.fromPromise(
      this.breaker.fire(url, init),
      e => new FirecrawlClientError('Network or Circuit Breaker error', e)
    ).andThen((response: Response) => {
      return ResultAsync.fromPromise(
        response.json(),
        e => new FirecrawlClientError('Failed to parse JSON response', e)
      ).andThen(json => {
        const result = ScrapeResponseSchema.safeParse(json);
        if (!result.success) {
          return err(new FirecrawlClientError('Invalid response schema from Firecrawl', result.error));
        }
        return ok(result.data);
      });
    });
  }

  async health(): Promise<Result<boolean, FirecrawlClientError>> {
    try {
      const response = await fetch(`${this.options.baseUrl}/health`);
      return ok(response.status === 200);
    } catch (e) {
      return err(new FirecrawlClientError('Health check failed', e));
    }
  }
}

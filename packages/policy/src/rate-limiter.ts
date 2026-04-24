import { Result, ok, err } from 'neverthrow';

export interface RateLimitConfig {
  readonly maxRequestsPerSecond: number;
  readonly maxRequestsPerMinute: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
  readonly remainingInWindow: number;
}

interface WindowBucket {
  readonly timestamp: number;
  count: number;
}

export class RateLimiter {
  private readonly perSecondBuckets: Map<string, WindowBucket[]> = new Map();
  private readonly perMinuteBuckets: Map<string, WindowBucket[]> = new Map();

  constructor(private readonly config: RateLimitConfig) {}

  async check(domain: string): Promise<Result<RateLimitResult, Error>> {
    const now = Date.now();
    const secondResult = this.checkWindow(
      domain,
      now,
      this.perSecondBuckets,
      1000,
      this.config.maxRequestsPerSecond,
    );
    const minuteResult = this.checkWindow(
      domain,
      now,
      this.perMinuteBuckets,
      60000,
      this.config.maxRequestsPerMinute,
    );

    if (!secondResult.allowed) {
      return ok({
        allowed: false,
        retryAfterMs: secondResult.retryAfterMs,
        remainingInWindow: secondResult.remaining,
      });
    }

    if (!minuteResult.allowed) {
      return ok({
        allowed: false,
        retryAfterMs: minuteResult.retryAfterMs,
        remainingInWindow: minuteResult.remaining,
      });
    }

    const remaining = Math.min(secondResult.remaining, minuteResult.remaining);
    return ok({
      allowed: true,
      retryAfterMs: 0,
      remainingInWindow: remaining,
    });
  }

  async record(domain: string): Promise<void> {
    const now = Date.now();
    this.recordBucket(domain, now, this.perSecondBuckets, 1000);
    this.recordBucket(domain, now, this.perMinuteBuckets, 60000);
  }

  private checkWindow(
    domain: string,
    now: number,
    buckets: Map<string, WindowBucket[]>,
    windowMs: number,
    maxRequests: number,
  ): { allowed: boolean; retryAfterMs: number; remaining: number } {
    const domainBuckets = buckets.get(domain) ?? [];
    const cutoff = now - windowMs;
    const activeBuckets = domainBuckets.filter(b => b.timestamp > cutoff);
    const totalCount = activeBuckets.reduce((sum, b) => sum + b.count, 0);

    if (totalCount >= maxRequests) {
      const oldest = activeBuckets[0];
      const retryAfterMs = oldest
        ? Math.max(0, oldest.timestamp + windowMs - now + 1)
        : windowMs;
      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: maxRequests - totalCount,
    };
  }

  private recordBucket(
    domain: string,
    now: number,
    buckets: Map<string, WindowBucket[]>,
    _windowMs: number,
  ): void {
    const domainBuckets = buckets.get(domain) ?? [];
    const existing = domainBuckets.find(b => b.timestamp === now);
    if (existing) {
      existing.count += 1;
    } else {
      domainBuckets.push({ timestamp: now, count: 1 });
    }
    buckets.set(domain, domainBuckets);
  }
}
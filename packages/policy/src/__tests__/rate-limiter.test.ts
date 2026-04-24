import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, type RateLimitConfig } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    const config: RateLimitConfig = {
      maxRequestsPerSecond: 5,
      maxRequestsPerMinute: 100,
    };
    limiter = new RateLimiter(config);
  });

  it('allows requests under the limit', async () => {
    const result = await limiter.check('example.com');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.allowed).toBe(true);
      expect(result.value.remainingInWindow).toBeGreaterThan(0);
    }
  });

  it('rejects requests over per-second limit', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.record('example.com');
    }

    const result = await limiter.check('example.com');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.allowed).toBe(false);
      expect(result.value.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('tracks counters per domain independently', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.record('example.com');
    }

    const blocked = await limiter.check('example.com');
    const other = await limiter.check('other.com');
    expect(blocked.isOk() && blocked.value.allowed).toBe(false);
    expect(other.isOk() && other.value.allowed).toBe(true);
  });

  it('records requests and increments counter', async () => {
    await limiter.record('example.com');

    const result = await limiter.check('example.com');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.remainingInWindow).toBeLessThan(5);
    }
  });

  it('returns remainingInWindow correctly', async () => {
    const result = await limiter.check('fresh-domain.com');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.remainingInWindow).toBe(5);
    }
  });
});
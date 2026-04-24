import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserPool, BrowserPoolError } from '../browser-pool.js';

vi.mock('playwright', () => {
  const mockContext = {
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

describe('BrowserPool', () => {
  let pool: BrowserPool;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new BrowserPool({ maxContexts: 2 });
  });

  describe('initialize', () => {
    it('should launch a browser on first initialize', async () => {
      const result = await pool.initialize();
      expect(result.isOk()).toBe(true);
    });

    it('should return ok on subsequent initialize calls', async () => {
      await pool.initialize();
      const result = await pool.initialize();
      expect(result.isOk()).toBe(true);
    });
  });

  describe('createContext', () => {
    it('should fail if browser is not initialized', async () => {
      const result = await pool.createContext();
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(BrowserPoolError);
    });

    it('should create a context and increment active count', async () => {
      await pool.initialize();
      const result = await pool.createContext();
      expect(result.isOk()).toBe(true);
      expect(pool.getActiveContextCount()).toBe(1);
    });

    it('should fail when maxContexts is reached', async () => {
      await pool.initialize();
      const ctx1 = await pool.createContext();
      expect(ctx1.isOk()).toBe(true);
      const ctx2 = await pool.createContext();
      expect(ctx2.isOk()).toBe(true);
      const ctx3 = await pool.createContext();
      expect(ctx3.isErr()).toBe(true);
      expect(ctx3._unsafeUnwrapErr().message).toContain('Maximum contexts');
    });
  });

  describe('releaseContext', () => {
    it('should decrement active count when context is released', async () => {
      await pool.initialize();
      const result = await pool.createContext();
      expect(result.isOk()).toBe(true);
      expect(pool.getActiveContextCount()).toBe(1);

      await pool.releaseContext(result._unsafeUnwrap());
      expect(pool.getActiveContextCount()).toBe(0);
    });

    it('should not go below zero active contexts', async () => {
      await pool.initialize();
      const result = await pool.createContext();
      expect(result.isOk()).toBe(true);

      await pool.releaseContext(result._unsafeUnwrap());
      await pool.releaseContext(result._unsafeUnwrap());
      expect(pool.getActiveContextCount()).toBe(0);
    });
  });

  describe('close', () => {
    it('should close the browser and reset state', async () => {
      await pool.initialize();
      const ctx = await pool.createContext();
      expect(ctx.isOk()).toBe(true);
      expect(pool.getActiveContextCount()).toBe(1);

      await pool.close();
      expect(pool.getActiveContextCount()).toBe(0);
    });

    it('should be a no-op if browser is not initialized', async () => {
      await expect(pool.close()).resolves.toBeUndefined();
    });
  });
});
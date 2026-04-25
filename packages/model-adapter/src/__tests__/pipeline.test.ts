import { describe, it, expect, vi } from 'vitest';
import { ok, err, type Result } from 'neverthrow';
import { z } from 'zod';
import { ExtractionPipeline, ExtractionError } from '../pipeline.js';
import { ModelRouter } from '../router.js';
import type { ModelAdapter, ExtractionResult, RelevanceScore } from '../adapter.js';
import { AdapterError } from '../adapter.js';

const testSchema = z.object({ title: z.string() });

const validResult: ExtractionResult = {
  data: { title: 'Hello' },
  confidence: 1,
  sourceQuotes: [{ field: 'title', quote: 'Hello', confidence: 0.9 }],
  nullFields: [],
};

function makeZodError(): z.ZodError {
  return testSchema.safeParse({ title: 123 }).error ?? new z.ZodError([]);
}

function createMockAdapter(
  overrides: {
    extractJsonResult?: Result<ExtractionResult, AdapterError>;
    repairJsonResult?: Result<ExtractionResult, AdapterError>;
  } = {},
): ModelAdapter {
  const defaultRelevance: RelevanceScore = { score: 0.5, reason: 'mock' };

  return {
    name: 'mock-model',
    capabilities: new Set(['text', 'json', 'cheap'] as const),
    extractJson: vi.fn(async () => {
      if (overrides.extractJsonResult) return overrides.extractJsonResult;
      return ok(validResult);
    }),
    repairJson: vi.fn(async () => {
      if (overrides.repairJsonResult) return overrides.repairJsonResult;
      return ok(validResult);
    }),
    classifyPageRelevance: vi.fn(async () => ok(defaultRelevance)),
    setLogger: vi.fn(),
  };
}

describe('ExtractionPipeline', () => {
  it('returns successful extraction on first pass', async () => {
    const adapter = createMockAdapter();
    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router);

    const result = await pipeline.extract('# Hello', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data).toEqual({ title: 'Hello' });
    }
  });

  it('triggers repair when extraction returns schema validation failure', async () => {
    const zodError = makeZodError();

    const adapter = createMockAdapter({
      extractJsonResult: err(new AdapterError(
        'Schema validation failed',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 123}',
      )),
      repairJsonResult: ok({
        data: { title: 'Fixed Title' },
        confidence: 0.9,
        sourceQuotes: [{ field: 'title', quote: 'Fixed Title', confidence: 0.8 }],
        nullFields: [],
      }),
    });

    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router);

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data.title).toBe('Fixed Title');
    }
    expect(adapter.repairJson).toHaveBeenCalledTimes(1);
  });

  it('returns ExtractionError when max repair attempts are exhausted', async () => {
    const zodError = makeZodError();

    const adapter = createMockAdapter({
      extractJsonResult: err(new AdapterError(
        'Schema validation failed',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 123}',
      )),
      repairJsonResult: err(new AdapterError(
        'Repair failed — schema still invalid',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 456}',
      )),
    });

    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router, { maxRepairAttempts: 2 });

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ExtractionError);
      expect(result.error.attempts).toBe(3);
    }
    expect(adapter.repairJson).toHaveBeenCalledTimes(2);
  });

  it('returns ExtractionError when no model is available', async () => {
    const router = new ModelRouter([]);
    const pipeline = new ExtractionPipeline(router);

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ExtractionError);
      expect(result.error.attempts).toBe(0);
    }
  });

  it('returns error immediately on non-validation adapter errors', async () => {
    const adapter = createMockAdapter({
      extractJsonResult: err(new AdapterError('Connection refused', 'CONNECTION_ERROR')),
    });

    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router);

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.attempts).toBe(1);
      if (result.error.lastError && 'code' in result.error.lastError) {
        expect((result.error.lastError as AdapterError).code).toBe('CONNECTION_ERROR');
      }
    }
    expect(adapter.repairJson).not.toHaveBeenCalled();
  });

  it('respects maxRepairAttempts option override', async () => {
    const zodError = makeZodError();

    const adapter = createMockAdapter({
      extractJsonResult: err(new AdapterError(
        'Schema validation failed',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 123}',
      )),
      repairJsonResult: err(new AdapterError(
        'Repair failed',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 456}',
      )),
    });

    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router, { maxRepairAttempts: 1 });

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.attempts).toBe(2);
    }
    expect(adapter.repairJson).toHaveBeenCalledTimes(1);
  });

  it('succeeds on second repair attempt after first failure', async () => {
    const zodError = makeZodError();

    let repairCalls = 0;
    const adapter: ModelAdapter = {
      name: 'mock-model',
      capabilities: new Set(['text', 'json', 'cheap'] as const),
      extractJson: vi.fn(async () => err(new AdapterError(
        'Schema validation failed',
        'INVALID_RESPONSE',
        zodError,
        '{"title": 123}',
      ))),
      repairJson: vi.fn(async () => {
        repairCalls += 1;
        if (repairCalls === 1) {
          return err(new AdapterError('Repair failed', 'INVALID_RESPONSE', zodError, '{"title": 456}'));
        }
        return ok({
          data: { title: 'Repaired Title' },
          confidence: 0.85,
          sourceQuotes: [{ field: 'title', quote: 'Repaired Title', confidence: 0.85 }],
          nullFields: [],
        });
      }),
      classifyPageRelevance: vi.fn(async () => ok({ score: 0.5, reason: 'mock' })),
      setLogger: vi.fn(),
    };

    const router = new ModelRouter([adapter]);
    const pipeline = new ExtractionPipeline(router, { maxRepairAttempts: 2 });

    const result = await pipeline.extract('# Page', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data.title).toBe('Repaired Title');
    }
  });
});
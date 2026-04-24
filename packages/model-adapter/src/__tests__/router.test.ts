import { describe, it, expect } from 'vitest';
import { ModelRouter, RouterError } from '../router.js';
import type { ModelAdapter, ModelCapability, ExtractionResult, RelevanceScore } from '../adapter.js';
import { AdapterError } from '../adapter.js';
import { ok, type Result } from 'neverthrow';
import { z } from 'zod';

function createMockModel(name: string, capabilities: ReadonlyArray<ModelCapability>): ModelAdapter {
  const caps = new Set(capabilities);
  const dummyResult: ExtractionResult = {
    data: {},
    confidence: 1,
    sourceQuotes: [],
    nullFields: [],
  };
  const dummyRelevance: RelevanceScore = { score: 0.5, reason: 'mock' };

  return {
    name,
    capabilities: caps,
    extractJson: async (): Promise<Result<ExtractionResult, AdapterError>> => ok(dummyResult),
    repairJson: async (): Promise<Result<ExtractionResult, AdapterError>> => ok(dummyResult),
    classifyPageRelevance: async (): Promise<Result<RelevanceScore, AdapterError>> => ok(dummyRelevance),
  };
}

describe('ModelRouter', () => {
  it('selects cheapest model with all required capabilities', () => {
    const cheap = createMockModel('cheap-model', ['text', 'json', 'cheap']);
    const expensive = createMockModel('expensive-model', ['text', 'json']);
    const router = new ModelRouter([expensive, cheap]);

    const result = router.selectForCapabilities(['text', 'json']);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('cheap-model');
    }
  });

  it('returns error when no model has all required capabilities', () => {
    const textOnly = createMockModel('text-only', ['text']);
    const router = new ModelRouter([textOnly]);

    const result = router.selectForCapabilities(['text', 'vision']);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RouterError);
      expect(result.error.required).toContain('vision');
    }
  });

  it('prefers non-fallback models over fallback models', () => {
    const fallback = createMockModel('fallback', ['text', 'json', 'fallback']);
    const primary = createMockModel('primary', ['text', 'json']);
    const router = new ModelRouter([fallback, primary]);

    const result = router.selectForCapabilities(['text', 'json']);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('primary');
    }
  });

  it('selectForText returns text+json model', () => {
    const vision = createMockModel('vision', ['text', 'vision', 'json']);
    const text = createMockModel('text-only', ['text', 'json', 'cheap']);
    const router = new ModelRouter([vision, text]);

    const result = router.selectForText();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('text-only');
    }
  });

  it('selectForVision returns text+vision+json model', () => {
    const textOnly = createMockModel('text', ['text', 'json', 'cheap']);
    const vision = createMockModel('vision', ['text', 'vision', 'json']);
    const router = new ModelRouter([textOnly, vision]);

    const result = router.selectForVision();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('vision');
    }
  });

  it('selectForClassification prefers cheap+text model', () => {
    const expensive = createMockModel('expensive', ['text', 'json']);
    const cheap = createMockModel('cheap', ['text', 'cheap']);
    const router = new ModelRouter([expensive, cheap]);

    const result = router.selectForClassification();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('cheap');
    }
  });

  it('selectForClassification falls back to text-only when no cheap model available', () => {
    const textOnly = createMockModel('text', ['text', 'json']);
    const router = new ModelRouter([textOnly]);

    const result = router.selectForClassification();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('text');
    }
  });

  it('returns error when no models are registered', () => {
    const router = new ModelRouter([]);

    const result = router.selectForText();

    expect(result.isErr()).toBe(true);
  });
});
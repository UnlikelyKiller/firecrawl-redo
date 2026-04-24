import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { OllamaAdapter } from '../ollama.js';
import { OpenAICompatAdapter } from '../openai-compat.js';
import { AdapterError } from '../adapter.js';
import type { ModelCapability } from '../adapter.js';
import {
  KIMI_K2_CAPABILITIES,
  OLLAMA_DEFAULT_CAPABILITIES,
  OPENAI_COMPAT_CAPABILITIES,
} from '../capabilities.js';

const testSchema = z.object({ title: z.string() });

function mockFetch(responseBody: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  })));
}

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter({ baseUrl: 'http://localhost:11434', model: 'llama3' });
    vi.restoreAllMocks();
  });

  it('has correct Name and capabilities', () => {
    expect(adapter.name).toBe('ollama:llama3');
    expect(adapter.capabilities.has('text')).toBe(true);
    expect(adapter.capabilities.has('json')).toBe(true);
    expect(adapter.capabilities.has('cheap')).toBe(true);
  });

  it('extracts valid JSON successfully', async () => {
    mockFetch({
      message: { content: '{"title": "Hello World"}' },
    });

    const result = await adapter.extractJson('# Hello World', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data).toEqual({ title: 'Hello World' });
    }
  });

  it('returns INVALID_RESPONSE when schema validation fails', async () => {
    mockFetch({
      message: { content: '{"title": 123}' },
    });

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_RESPONSE');
    }
  });

  it('returns CONNECTION_ERROR on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network error');
    }));

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONNECTION_ERROR');
    }
  });

  it('returns RATE_LIMITED on 429 status', async () => {
    mockFetch({ error: 'too many requests' }, 429);

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  it('classifies page relevance', async () => {
    mockFetch({
      message: { content: '{"score": 0.85, "reason": "highly relevant"}' },
    });

    const result = await adapter.classifyPageRelevance('# AI article', 'find AI articles');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.score).toBe(0.85);
      expect(result.value.reason).toBe('highly relevant');
    }
  });

  it('repairs invalid JSON', async () => {
    const zodError = testSchema.safeParse({ title: 123 }).error ?? new z.ZodError([]);

    mockFetch({
      message: { content: '{"title": "Fixed Title"}' },
    });

    const result = await adapter.repairJson('{"title": 123}', zodError, testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data.title).toBe('Fixed Title');
      expect(result.value.confidence).toBeLessThan(1);
    }
  });

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockFetch({
      message: { content: '```json\n{"title": "Hello"}\n```' },
    });

    const result = await adapter.extractJson('# Hello', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data.title).toBe('Hello');
    }
  });

  it('strips markdown fences with uppercase', async () => {
    mockFetch({
      message: { content: '```JSON\n{"title": "Test"}\n```' },
    });

    const result = await adapter.extractJson('# Test', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data.title).toBe('Test');
    }
  });
});

describe('OpenAICompatAdapter', () => {
  let adapter: OpenAICompatAdapter;

  beforeEach(() => {
    adapter = new OpenAICompatAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4',
    });
    vi.restoreAllMocks();
  });

  it('has correct name and default capabilities', () => {
    expect(adapter.name).toBe('openai-compat:gpt-4');
    expect(adapter.capabilities.has('text')).toBe(true);
    expect(adapter.capabilities.has('vision')).toBe(true);
    expect(adapter.capabilities.has('json')).toBe(true);
    expect(adapter.capabilities.has('tools')).toBe(true);
  });

  it('allows custom capabilities', () => {
    const customCaps = new Set(['text', 'json'] as const satisfies ReadonlyArray<ModelCapability>);
    const customAdapter = new OpenAICompatAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'custom',
      capabilities: customCaps,
    });
    expect(customAdapter.capabilities.has('vision')).toBe(false);
    expect(customAdapter.capabilities.has('text')).toBe(true);
  });

  it('extracts valid JSON successfully', async () => {
    mockFetch({
      choices: [{ message: { content: '{"title": "Hello from OpenAI"}' } }],
    });

    const result = await adapter.extractJson('# Hello', testSchema);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data).toEqual({ title: 'Hello from OpenAI' });
    }
  });

  it('sends Authorization header', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const fetchSpy = vi.fn(async (url: string, opts: RequestInit) => {
      capturedHeaders = opts.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"title": "test"}' } }] }),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fetchSpy);

    await adapter.extractJson('# test', testSchema);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(capturedHeaders?.['Authorization']).toBe('Bearer test-key');
  });

  it('returns INVALID_RESPONSE when schema validation fails', async () => {
    mockFetch({
      choices: [{ message: { content: '{"title": 42}' } }],
    });

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_RESPONSE');
    }
  });

  it('returns INVALID_RESPONSE for empty content', async () => {
    mockFetch({
      choices: [{ message: { content: '' } }],
    });

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_RESPONSE');
    }
  });

  it('classifies page relevance', async () => {
    mockFetch({
      choices: [{ message: { content: '{"score": 0.7, "reason": "somewhat relevant"}' } }],
    });

    const result = await adapter.classifyPageRelevance('# Article', 'find articles');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.score).toBe(0.7);
    }
  });

  it('returns RATE_LIMITED on 429', async () => {
    mockFetch({ error: 'rate limited' }, 429);

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
  });

  it('returns CONNECTION_ERROR on 5xx', async () => {
    mockFetch({ error: 'internal error' }, 500);

    const result = await adapter.extractJson('# Page', testSchema);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CONNECTION_ERROR');
    }
  });
});

describe('capability presets', () => {
  it('KIMI_K2_CAPABILITIES has text, json, long_context', () => {
    expect(KIMI_K2_CAPABILITIES.has('text')).toBe(true);
    expect(KIMI_K2_CAPABILITIES.has('json')).toBe(true);
    expect(KIMI_K2_CAPABILITIES.has('long_context')).toBe(true);
    expect(KIMI_K2_CAPABILITIES.has('vision')).toBe(false);
  });

  it('OLLAMA_DEFAULT_CAPABILITIES has text, json, cheap', () => {
    expect(OLLAMA_DEFAULT_CAPABILITIES.has('text')).toBe(true);
    expect(OLLAMA_DEFAULT_CAPABILITIES.has('json')).toBe(true);
    expect(OLLAMA_DEFAULT_CAPABILITIES.has('cheap')).toBe(true);
    expect(OLLAMA_DEFAULT_CAPABILITIES.has('vision')).toBe(false);
  });

  it('OPENAI_COMPAT_CAPABILITIES has text, vision, json, tools', () => {
    expect(OPENAI_COMPAT_CAPABILITIES.has('text')).toBe(true);
    expect(OPENAI_COMPAT_CAPABILITIES.has('vision')).toBe(true);
    expect(OPENAI_COMPAT_CAPABILITIES.has('json')).toBe(true);
    expect(OPENAI_COMPAT_CAPABILITIES.has('tools')).toBe(true);
    expect(OPENAI_COMPAT_CAPABILITIES.has('cheap')).toBe(false);
  });
});
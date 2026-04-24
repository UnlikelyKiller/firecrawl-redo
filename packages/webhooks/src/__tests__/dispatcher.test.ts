import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookDispatcher } from '../dispatcher.js';
import type { WebhookSubscription, WebhookEvent } from '../dispatcher.js';
import { signWebhook } from '../signer.js';

function makeSubscription(overrides: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    id: 'sub-1',
    url: 'https://example.com/webhook',
    events: ['job.completed'],
    secret: 'test-secret',
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: 'evt-1',
    type: 'job.completed',
    payload: { jobId: 'job-123' },
    timestamp: new Date(),
    ...overrides,
  };
}

describe('WebhookDispatcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers webhook with HMAC signature', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher();
    const subscription = makeSubscription();
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const delivery = result.value;
      expect(delivery.status).toBe('delivered');
      expect(delivery.attempts).toBe(1);
      expect(delivery.responseStatusCode).toBe(200);
      expect(delivery.subscriptionId).toBe('sub-1');
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0]!;
    const body = call[1]?.body as string;
    const headers = call[1]?.headers as Record<string, string>;
    const expectedSig = signWebhook(body, 'test-secret');
    expect(headers['X-Webhook-Signature']).toBe(`sha256=${expectedSig}`);
    expect(headers['X-Webhook-Event-Id']).toBe('evt-1');

    vi.restoreAllMocks();
  });

  it('retries with exponential backoff on failure', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ ok: true, status: 200 });

    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher({ maxRetries: 3, retryBackoffMs: 10, timeoutMs: 5000 });
    const subscription = makeSubscription();
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value.status).toBe('delivered');
      expect(result.value.attempts).toBe(3);
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
  });

  it('returns failed delivery after max retries exceeded', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher({ maxRetries: 2, retryBackoffMs: 10, timeoutMs: 5000 });
    const subscription = makeSubscription();
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value.status).toBe('failed');
      expect(result.value.attempts).toBe(3);
      expect(result.value.error).toBe('Network error');
    }

    vi.restoreAllMocks();
  });

  it('blocks local URLs when allowLocalUrls is false', async () => {
    const dispatcher = new WebhookDispatcher({ allowLocalUrls: false });
    const subscription = makeSubscription({ url: 'http://localhost:3000/webhook' });
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isErr()).toBe(true);

    if (result.isErr()) {
      expect(result.error.message).toContain('Local URL blocked');
    }
  });

  it('allows local URLs when allowLocalUrls is true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher({ allowLocalUrls: true, retryBackoffMs: 10 });
    const subscription = makeSubscription({ url: 'http://localhost:3000/webhook' });
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value.status).toBe('delivered');
    }

    vi.restoreAllMocks();
  });

  it('includes idempotency key in payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher();
    const subscription = makeSubscription();
    const event = makeEvent({ id: 'evt-idempotent-1' });

    await dispatcher.dispatch(subscription, event);

    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.id).toBe('evt-idempotent-1');
    expect(body.type).toBe('job.completed');

    const headers = call[1]?.headers as Record<string, string>;
    expect(headers['X-Webhook-Event-Id']).toBe('evt-idempotent-1');

    vi.restoreAllMocks();
  });

  it('treats non-2xx responses as failures that trigger retry', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    vi.stubGlobal('fetch', mockFetch);

    const dispatcher = new WebhookDispatcher({ maxRetries: 3, retryBackoffMs: 10, timeoutMs: 5000 });
    const subscription = makeSubscription();
    const event = makeEvent();

    const result = await dispatcher.dispatch(subscription, event);
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value.status).toBe('delivered');
      expect(result.value.attempts).toBe(2);
    }

    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it('blocks private IP ranges', async () => {
    const dispatcher = new WebhookDispatcher({ allowLocalUrls: false });

    const localUrls = [
      'http://127.0.0.1/webhook',
      'http://10.0.0.1/webhook',
      'http://192.168.1.1/webhook',
      'http://172.16.0.1/webhook',
    ];

    for (const url of localUrls) {
      const subscription = makeSubscription({ url });
      const event = makeEvent();
      const result = await dispatcher.dispatch(subscription, event);
      expect(result.isErr()).toBe(true);
    }
  });
});
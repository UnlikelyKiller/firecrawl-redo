import { ResultAsync, okAsync, errAsync } from 'neverthrow';
import * as crypto from 'node:crypto';
import { signWebhook } from './signer.js';

export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: Date;
}

export interface WebhookDelivery {
  readonly id: string;
  readonly subscriptionId: string;
  readonly event: WebhookEvent;
  readonly status: 'pending' | 'delivered' | 'failed';
  readonly attempts: number;
  readonly lastAttemptAt?: Date;
  readonly responseStatusCode?: number;
  readonly error?: string;
}

export interface WebhookSubscription {
  readonly id: string;
  readonly url: string;
  readonly events: ReadonlyArray<string>;
  readonly secret: string;
  readonly active: boolean;
  readonly createdAt: Date;
}

export interface WebhookDispatcherOptions {
  readonly maxRetries: number;
  readonly retryBackoffMs: number;
  readonly timeoutMs: number;
  readonly allowLocalUrls: boolean;
}

const DEFAULT_OPTIONS: WebhookDispatcherOptions = {
  maxRetries: 3,
  retryBackoffMs: 1000,
  timeoutMs: 30000,
  allowLocalUrls: false,
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLocalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname;
    if (LOCAL_HOSTNAMES.has(hostname)) return true;
    if (hostname.endsWith('.local')) return true;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
    const parts = hostname.split('.');
    if (parts.length === 4 && parts[0] === '172') {
      const second = parseInt(parts[1]!, 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebhookDispatcher {
  private readonly options: WebhookDispatcherOptions;

  constructor(options: Partial<WebhookDispatcherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async dispatch(
    subscription: WebhookSubscription,
    event: WebhookEvent,
  ): Promise<ResultAsync<WebhookDelivery, Error>> {
    if (!this.options.allowLocalUrls && isLocalUrl(subscription.url)) {
      return errAsync<WebhookDelivery, Error>(
        new Error(`Local URL blocked: ${subscription.url}`),
      );
    }

    const payload = JSON.stringify({
      id: event.id,
      type: event.type,
      payload: event.payload,
      timestamp: event.timestamp.toISOString(),
    });

    const signature = signWebhook(payload, subscription.secret);

    let lastStatusCode: number | undefined;
    let lastError: string | undefined;
    let attempts = 0;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      attempts = attempt + 1;

      if (attempt > 0) {
        await sleep(this.options.retryBackoffMs * Math.pow(2, attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event-Id': event.id,
          },
          body: payload,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        lastStatusCode = response.status;

        if (response.ok) {
          return okAsync<WebhookDelivery, Error>({
            id: crypto.randomUUID(),
            subscriptionId: subscription.id,
            event,
            status: 'delivered',
            attempts,
            lastAttemptAt: new Date(),
            responseStatusCode: response.status,
          });
        }

        lastError = `HTTP ${response.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    const failedDelivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      event,
      status: 'failed',
      attempts,
      lastAttemptAt: new Date(),
      ...(lastStatusCode !== undefined ? { responseStatusCode: lastStatusCode } : {}),
      ...(lastError !== undefined ? { error: lastError } : {}),
    };

    return okAsync<WebhookDelivery, Error>(failedDelivery);
  }
}
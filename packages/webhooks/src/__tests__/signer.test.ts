import { describe, it, expect } from 'vitest';
import { signWebhook, verifyWebhookSignature } from '../signer.js';

describe('signWebhook', () => {
  it('produces a hex string of 64 characters (SHA-256)', () => {
    const result = signWebhook('test payload', 'secret');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different signatures for different payloads', () => {
    const a = signWebhook('payload a', 'secret');
    const b = signWebhook('payload b', 'secret');
    expect(a).not.toBe(b);
  });

  it('produces different signatures for different secrets', () => {
    const a = signWebhook('payload', 'secret-a');
    const b = signWebhook('payload', 'secret-b');
    expect(a).not.toBe(b);
  });
});

describe('verifyWebhookSignature', () => {
  it('verifies a round-trip sign and verify', () => {
    const payload = '{"event":"job.completed","id":"123"}';
    const secret = 'my-webhook-secret';
    const signature = signWebhook(payload, secret);

    expect(verifyWebhookSignature(payload, secret, signature)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const payload = '{"event":"job.completed","id":"123"}';
    const signature = signWebhook(payload, 'correct-secret');

    expect(verifyWebhookSignature(payload, 'wrong-secret', signature)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const payload = '{"event":"job.completed","id":"123"}';
    const secret = 'my-webhook-secret';
    const signature = signWebhook(payload, secret);
    const tampered = signature.replace(/^.{2}/, 'ff');

    expect(verifyWebhookSignature(payload, secret, tampered)).toBe(false);
  });

  it('rejects signatures of different length', () => {
    expect(verifyWebhookSignature('payload', 'secret', 'tooshort')).toBe(false);
  });
});
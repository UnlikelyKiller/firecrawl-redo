import { describe, it, expect } from 'vitest';
import { SecretRedactor } from '../secret-redactor';

describe('SecretRedactor', () => {
  describe('redact - Bearer tokens are redacted', () => {
    it('redacts Bearer token in Authorization header', () => {
      const input = 'Authorization: Bearer abc123def456';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('abc123def456');
        expect(result.value).toContain('Bearer');
      }
    });

    it('redacts lowercase bearer token', () => {
      const input = 'bearer my-secret-token';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('my-secret-token');
      }
    });
  });

  describe('redact - API keys are redacted', () => {
    it('redacts api_key pattern', () => {
      const input = 'api_key: sk-abc123def456ghi789';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('sk-abc123def456ghi789');
      }
    });

    it('redacts apiKey pattern', () => {
      const input = 'apiKey: my-secret-key-123';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('my-secret-key-123');
      }
    });

    it('redacts api-key pattern', () => {
      const input = '"api-key": "sk-12345"';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('sk-12345');
      }
    });
  });

  describe('redact - passwords in URLs are redacted', () => {
    it('redacts password in URL-style string', () => {
      const input = 'password: mysecretpassword';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('mysecretpassword');
      }
    });

    it('redacts password in JSON key-value', () => {
      const input = '"password": "hunter2"';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('hunter2');
      }
    });
  });

  describe('redact - secrets are redacted', () => {
    it('redacts secret pattern', () => {
      const input = 'secret: my-super-secret-value';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('my-super-secret-value');
      }
    });
  });

  describe('redact - tokens are redacted', () => {
    it('redacts token pattern', () => {
      const input = 'token: ghp_abc123def456';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toContain('***REDACTED***');
        expect(result.value).not.toContain('ghp_abc123def456');
      }
    });
  });

  describe('redact - clean strings pass through unchanged', () => {
    const cleanStrings: readonly string[] = [
      'Hello, world!',
      'https://example.com/api/data',
      'The quick brown fox jumps over the lazy dog',
      '{"name": "John", "age": 30}',
      'status: ok',
      '',
    ];

    for (const input of cleanStrings) {
      it(`passes through: "${input.slice(0, 40)}${input.length > 40 ? '...' : ''}"`, () => {
        const result = SecretRedactor.redact(input);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(input);
        }
      });
    }
  });

  describe('redact - multiple secrets in one string', () => {
    it('redacts multiple secrets in a single string', () => {
      const input = 'Bearer token123 api_key: sk-abc password: hunter2';
      const result = SecretRedactor.redact(input);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toContain('token123');
        expect(result.value).not.toContain('sk-abc');
        expect(result.value).not.toContain('hunter2');
        expect(result.value).toContain('***REDACTED***');
      }
    });
  });
});
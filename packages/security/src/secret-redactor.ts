import { ok, err, Result } from 'neverthrow';

export class RedactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedactionError';
  }
}

export class SecretRedactor {
  private static readonly PATTERNS = [
    /(bearer\s+)[a-zA-Z0-9\-\._~]+/gi,
    /(api[_-]?key["':\s]+)[a-zA-Z0-9\-\._~]+/gi,
    /(password["':\s]+)[^"'\s,]+/gi,
    /(secret["':\s]+)[^"'\s,]+/gi,
    /(token["':\s]+)[a-zA-Z0-9\-\._~]+/gi
  ];

  static redact(payload: string): Result<string, RedactionError> {
    try {
      let redacted = payload;
      for (const pattern of SecretRedactor.PATTERNS) {
        redacted = redacted.replace(pattern, '$1***REDACTED***');
      }
      return ok(redacted);
    } catch (e) {
      return err(new RedactionError('Failed to redact string'));
    }
  }
}

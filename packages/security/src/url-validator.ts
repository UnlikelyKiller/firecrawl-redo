import { ok, err, Result } from 'neverthrow';

export class URLValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'URLValidationError';
  }
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'host.docker.internal',
  'metadata.google.internal',
  '169.254.169.254'
]);

const BLOCKED_SCHEMES = new Set(['file:', 'ftp:', 'chrome:', 'devtools:', 'data:']);

export interface URLValidatorOptions {
  // Exact-origin allowlist for the Multilogin bridge (scheme+host+port must match exactly)
  readonly allowedMultiloginBridgeOrigin?: string;
  // Exact-origin allowlist for the Tandem HTTP/MCP control surface (scheme+host+port must match exactly)
  readonly allowedTandemOrigin?: string;
  /**
   * @deprecated No longer broadens the allowlist. Use allowedMultiloginBridgeOrigin with
   * an exact origin instead. Kept for backward-compatible callers but has no effect.
   */
  readonly allowDirectMultiloginCdp?: boolean;
}

export class URLValidator {
  static validate(
    urlString: string,
    options: URLValidatorOptions = {}
  ): Result<URL, URLValidationError> {
    try {
      const url = new URL(urlString);
      const isAllowedOrigin = URLValidator.isAllowedExternalBackendOrigin(url, options);

      if (BLOCKED_SCHEMES.has(url.protocol)) {
        return err(new URLValidationError(`Blocked protocol: ${url.protocol}`));
      }

      if (BLOCKED_HOSTS.has(url.hostname) && !isAllowedOrigin) {
        return err(new URLValidationError(`Blocked host: ${url.hostname}`));
      }

      if (URLValidator.isPrivateIP(url.hostname) && !isAllowedOrigin) {
        return err(new URLValidationError(`Blocked private IP in hostname: ${url.hostname}`));
      }

      return ok(url);
    } catch (e) {
      return err(new URLValidationError('Invalid URL format'));
    }
  }

  private static isAllowedExternalBackendOrigin(
    url: URL,
    options: URLValidatorOptions
  ): boolean {
    const candidates = [
      options.allowedMultiloginBridgeOrigin,
      options.allowedTandemOrigin,
    ].filter((o): o is string => typeof o === 'string' && o.length > 0);

    return candidates.some(origin => {
      try {
        return url.origin === new URL(origin).origin;
      } catch {
        return false;
      }
    });
  }

  // Kept for backward compat — same semantics as before
  static allowsMultiloginBridgeOrigin(url: URL, options: URLValidatorOptions = {}): boolean {
    return URLValidator.isAllowedExternalBackendOrigin(url, options);
  }

  // @deprecated — always returns false; use exact-origin options instead
  static allowsDirectMultiloginCdp(_url: URL, _options: URLValidatorOptions = {}): boolean {
    return false;
  }

  static isPrivateIP(hostname: string): boolean {
    const parts = hostname.split('.');
    if (parts.length !== 4) return false;

    const nums = parts.map(p => parseInt(p, 10));
    if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return false;

    if (nums[0] === 10) return true;
    if (nums[0] === 172 && nums[1] !== undefined && nums[1] >= 16 && nums[1] <= 31) return true;
    if (nums[0] === 192 && nums[1] === 168) return true;
    if (nums[0] === 127) return true;
    if (nums[0] === 169 && nums[1] === 254) return true;

    return false;
  }
}

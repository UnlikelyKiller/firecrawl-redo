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
const DIRECT_MULTILOGIN_CDP_HOSTS = new Set(['localhost', 'host.docker.internal', '127.0.0.1']);

export interface URLValidatorOptions {
  readonly allowedMultiloginBridgeOrigin?: string;
  readonly allowDirectMultiloginCdp?: boolean;
}

export class URLValidator {
  static validate(
    urlString: string,
    options: URLValidatorOptions = {}
  ): Result<URL, URLValidationError> {
    try {
      const url = new URL(urlString);
      const isAllowedMultiloginBridgeOrigin = URLValidator.isAllowedMultiloginBridgeOrigin(url, options);
      const isAllowedDirectMultiloginCdp = URLValidator.isAllowedDirectMultiloginCdp(url, options);

      if (BLOCKED_SCHEMES.has(url.protocol)) {
        return err(new URLValidationError(`Blocked protocol: ${url.protocol}`));
      }

      if (
        BLOCKED_HOSTS.has(url.hostname) &&
        !isAllowedMultiloginBridgeOrigin &&
        !isAllowedDirectMultiloginCdp
      ) {
        return err(new URLValidationError(`Blocked host: ${url.hostname}`));
      }

      if (
        URLValidator.isPrivateIP(url.hostname) &&
        !isAllowedMultiloginBridgeOrigin &&
        !isAllowedDirectMultiloginCdp
      ) {
        return err(new URLValidationError(`Blocked private IP in hostname: ${url.hostname}`));
      }

      return ok(url);
    } catch (e) {
      return err(new URLValidationError('Invalid URL format'));
    }
  }

  private static isAllowedMultiloginBridgeOrigin(
    url: URL,
    options: URLValidatorOptions
  ): boolean {
    if (!options.allowedMultiloginBridgeOrigin) {
      return false;
    }

    try {
      const configuredOrigin = new URL(options.allowedMultiloginBridgeOrigin);
      return url.origin === configuredOrigin.origin;
    } catch {
      return false;
    }
  }

  private static isAllowedDirectMultiloginCdp(
    url: URL,
    options: URLValidatorOptions
  ): boolean {
    return options.allowDirectMultiloginCdp === true &&
      DIRECT_MULTILOGIN_CDP_HOSTS.has(url.hostname);
  }

  static allowsMultiloginBridgeOrigin(url: URL, options: URLValidatorOptions = {}): boolean {
    return URLValidator.isAllowedMultiloginBridgeOrigin(url, options);
  }

  static allowsDirectMultiloginCdp(url: URL, options: URLValidatorOptions = {}): boolean {
    return URLValidator.isAllowedDirectMultiloginCdp(url, options);
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

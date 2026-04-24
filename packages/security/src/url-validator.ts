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

export class URLValidator {
  static validate(urlString: string): Result<URL, URLValidationError> {
    try {
      const url = new URL(urlString);
      
      if (BLOCKED_SCHEMES.has(url.protocol)) {
        return err(new URLValidationError(`Blocked protocol: ${url.protocol}`));
      }

      if (BLOCKED_HOSTS.has(url.hostname)) {
        return err(new URLValidationError(`Blocked host: ${url.hostname}`));
      }

      if (URLValidator.isPrivateIP(url.hostname)) {
        return err(new URLValidationError(`Blocked private IP in hostname: ${url.hostname}`));
      }

      return ok(url);
    } catch (e) {
      return err(new URLValidationError('Invalid URL format'));
    }
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

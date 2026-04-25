import * as dns from 'dns/promises';
import { ok, err, Result } from 'neverthrow';
import { URLValidator, type URLValidatorOptions } from './url-validator';

export class DNSGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DNSGuardError';
  }
}

export class DNSGuard {
  static async validateResolved(
    url: URL,
    options: URLValidatorOptions = {},
  ): Promise<Result<string, DNSGuardError>> {
    try {
      const hostname = url.hostname;
      const allowsExternalOrigin = URLValidator.allowsMultiloginBridgeOrigin(url, options);

      // If it's already an IP, we verified it in URLValidator
      if (URLValidator.isPrivateIP(hostname)) {
        if (allowsExternalOrigin) {
          return ok(hostname);
        }
        return err(new DNSGuardError(`Hostname is a private IP: ${hostname}`));
      }

      // Resolve DNS
      const addresses = await dns.resolve4(hostname);

      if (addresses.length === 0) {
        return err(new DNSGuardError(`No A records found for ${hostname}`));
      }

      const ip = addresses[0];
      if (ip && URLValidator.isPrivateIP(ip)) {
        if (allowsExternalOrigin) {
          return ok(ip);
        }
        return err(new DNSGuardError(`DNS resolved to private IP: ${ip}`));
      }

      return ok(ip as string);
    } catch (e) {
      return err(new DNSGuardError(`DNS resolution failed: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}

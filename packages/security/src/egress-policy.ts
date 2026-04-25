import { Result, ok, err } from 'neverthrow';
import { URLValidator, URLValidationError, URLValidatorOptions } from './url-validator';
import { DNSGuard, DNSGuardError } from './dns-guard';

export type EgressError = URLValidationError | DNSGuardError;

export class EgressPolicy {
  /**
   * Validates a URL and its resolved IP against egress security rules.
   * This is the combined SSRF protection (Layer 1 & Layer 2).
   */
  static async validate(
    url: string,
    options: URLValidatorOptions = {}
  ): Promise<Result<{ url: URL; ip: string }, EgressError>> {
    const urlResult = URLValidator.validate(url, options);
    if (urlResult.isErr()) {
      return err(urlResult.error);
    }

    const validatedUrl = urlResult.value;

    const dnsResult = await DNSGuard.validateResolved(validatedUrl, options);
    if (dnsResult.isErr()) {
      return err(dnsResult.error);
    }

    return ok({
      url: validatedUrl,
      ip: dnsResult.value
    });
  }
}

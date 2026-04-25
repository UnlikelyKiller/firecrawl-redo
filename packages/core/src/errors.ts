// CrawlX structured error types. All errors are discriminated unions.
// Production code must use neverthrow Result<T, CrawlXError> — no throw.

export type CrawlXErrorCode =
  // Profile identity errors
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_UNAVAILABLE'
  | 'LEASE_CONFLICT'
  | 'LEASE_NOT_FOUND'
  | 'LEASE_EXPIRED'
  | 'LEASE_TOKEN_INVALID'
  | 'PROXY_NOT_FOUND'
  | 'PROXY_MISMATCH'
  | 'PROXY_UNHEALTHY'
  | 'CROSS_TENANT_DENIED'
  // External backend errors
  | 'TANDEM_NOT_CONFIGURED'
  | 'TANDEM_UNAVAILABLE'
  | 'TANDEM_AUTH_FAILED'
  | 'TANDEM_CAPABILITY_UNSUPPORTED'
  | 'TANDEM_PROFILE_NOT_FOUND'
  | 'TANDEM_SESSION_NOT_FOUND'
  | 'TANDEM_LEASE_CONFLICT'
  | 'TANDEM_PROXY_MISMATCH'
  | 'TANDEM_POLICY_DENIED'
  // Policy errors
  | 'POLICY_DENIED'
  | 'EXTERNAL_BACKEND_NOT_PERMITTED'
  // Generic
  | 'UNKNOWN';

export interface CrawlXError {
  readonly code: CrawlXErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

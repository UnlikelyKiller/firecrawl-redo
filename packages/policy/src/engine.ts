import { Result, ok, err } from 'neverthrow';
import { URLValidator } from '../../security/src/url-validator';
import { RobotsParser } from './robots';
import { RateLimiter, type RateLimitConfig } from './rate-limiter';
import { isPathBlocked } from './path-matcher';

export type PolicyDecision =
  | 'allowed'
  | 'blocked_domain'
  | 'robots_blocked'
  | 'rate_limited'
  | 'path_blocked'
  | 'login_wall'
  | 'captcha_required'
  | 'manual_approval_required'
  | 'session_backend_required'
  | 'named_profile_required'
  | 'external_backend_denied'
  | 'human_session_required'
  | 'operator_handoff_required';

export interface PolicyCheckResult {
  readonly decision: PolicyDecision;
  readonly reason: string;
  readonly domain: string;
  readonly url: string;
  readonly ttlMs?: number;
}

export interface PolicyCheckContext {
  readonly requestedSessionBackend?: 'crawlx_local' | 'multilogin' | 'tandem';
  readonly namedProfileId?: string;
  readonly hasHumanSession?: boolean;
}

export interface DomainPolicy {
  readonly domain: string;
  readonly allowed: boolean;
  readonly rateLimitPerSecond?: number;
  readonly rateLimitPerMinute?: number;
  readonly blockedPaths: ReadonlyArray<string>;
  readonly allowedPaths: ReadonlyArray<string>;
  readonly loginWallPolicy: 'skip' | 'flag' | 'block';
  readonly captchaPolicy: 'skip' | 'flag' | 'block';
  readonly retentionDays?: number;
  readonly browserMode: 'static' | 'js' | 'playwright' | 'branded' | 'multilogin_required' | 'tandem_required';
  readonly sessionBackend: 'crawlx_local' | 'multilogin' | 'tandem';
  readonly requiresNamedProfile: boolean;
  readonly requiresManualApproval: boolean;
  readonly allowCloudEscalation: boolean;
  readonly allowsExternalBrowserBackend: boolean;
  readonly requiresHumanSession: boolean;
  readonly requiresOperatorHandoff: boolean;
}

const DEFAULT_BLOCKED_DOMAINS: ReadonlyArray<string> = [
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'reddit.com',
];

export class PolicyEngine {
  private readonly robotsParser: RobotsParser;
  private readonly rateLimiters: Map<string, RateLimiter> = new Map();
  private readonly defaultRateLimitConfig: RateLimitConfig = {
    maxRequestsPerSecond: 10,
    maxRequestsPerMinute: 600,
  };

  constructor(
    private readonly urlValidator: typeof URLValidator,
    private readonly domainPolicies: Map<string, DomainPolicy> = new Map(),
    private readonly defaultBlockedDomains: ReadonlyArray<string> = DEFAULT_BLOCKED_DOMAINS,
    robotsCacheTtlMs: number = 86400000,
  ) {
    this.robotsParser = new RobotsParser(robotsCacheTtlMs);
  }

  async check(
    url: string,
    context: PolicyCheckContext = {},
  ): Promise<Result<PolicyCheckResult, Error>> {
    const validated = this.urlValidator.validate(url);
    if (validated.isErr()) {
      return err(validated.error);
    }

    const parsed = validated.value;
    const domain = parsed.hostname;
    const path = parsed.pathname;

    const lowerDomain = domain.toLowerCase();
    const isDefaultBlocked = this.defaultBlockedDomains.some(
      d => lowerDomain === d || lowerDomain.endsWith(`.${d}`),
    );
    if (isDefaultBlocked) {
      return ok({
        decision: 'blocked_domain',
        reason: `domain_is_in_default_blocked_list:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    const policy = this.domainPolicies.get(lowerDomain);
    if (policy && !policy.allowed) {
      return ok({
        decision: 'blocked_domain',
        reason: `domain_policy_blocks:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    const pathResult = isPathBlocked(path, policy?.blockedPaths ?? [], policy?.allowedPaths ?? []);
    if (pathResult.blocked) {
      return ok({
        decision: 'path_blocked',
        reason: pathResult.reason,
        domain: lowerDomain,
        url,
      });
    }

    const robotsResult = await this.robotsParser.isAllowed(url);
    if (robotsResult.isErr()) {
      return ok({
        decision: 'allowed',
        reason: 'robots_check_failed_lenient_allow',
        domain: lowerDomain,
        url,
      });
    }
    if (!robotsResult.value) {
      return ok({
        decision: 'robots_blocked',
        reason: `robots_txt_disallows:${path}`,
        domain: lowerDomain,
        url,
      });
    }

    const limiter = this.getOrCreateRateLimiter(policy);
    const rateResult = await limiter.check(lowerDomain);
    if (rateResult.isErr()) {
      return ok({
        decision: 'allowed',
        reason: 'rate_limit_check_failed_lenient_allow',
        domain: lowerDomain,
        url,
      });
    }
    if (!rateResult.value.allowed) {
      return ok({
        decision: 'rate_limited',
        reason: `rate_limit_exceeded:retry_after_${rateResult.value.retryAfterMs}ms`,
        domain: lowerDomain,
        url,
        ttlMs: rateResult.value.retryAfterMs,
      });
    }

    if (policy?.browserMode === 'multilogin_required' || policy?.sessionBackend === 'multilogin') {
      if (context.requestedSessionBackend !== 'multilogin') {
        return ok({
          decision: 'session_backend_required',
          reason: `domain_requires_multilogin_backend:${lowerDomain}`,
          domain: lowerDomain,
          url,
        });
      }
    }

    if (policy?.browserMode === 'tandem_required' || policy?.sessionBackend === 'tandem') {
      if (context.requestedSessionBackend !== 'tandem') {
        return ok({
          decision: 'session_backend_required',
          reason: `domain_requires_tandem_backend:${lowerDomain}`,
          domain: lowerDomain,
          url,
        });
      }
    }

    const policyMandatesExternal =
      policy?.sessionBackend === 'multilogin' || policy?.browserMode === 'multilogin_required' ||
      policy?.sessionBackend === 'tandem' || policy?.browserMode === 'tandem_required';
    const isExternalBackend = context.requestedSessionBackend === 'tandem' || context.requestedSessionBackend === 'multilogin';
    if (isExternalBackend && !policyMandatesExternal && !policy?.allowsExternalBrowserBackend) {
      return ok({
        decision: 'external_backend_denied',
        reason: `domain_does_not_permit_external_backend:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.requiresHumanSession && !context.hasHumanSession) {
      return ok({
        decision: 'human_session_required',
        reason: `domain_requires_human_session:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.requiresOperatorHandoff) {
      return ok({
        decision: 'operator_handoff_required',
        reason: `domain_requires_operator_handoff:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.requiresNamedProfile && !context.namedProfileId) {
      return ok({
        decision: 'named_profile_required',
        reason: `domain_requires_named_profile:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.requiresManualApproval) {
      return ok({
        decision: 'manual_approval_required',
        reason: `domain_requires_manual_approval:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.captchaPolicy === 'block') {
      return ok({
        decision: 'captcha_required',
        reason: `domain_captcha_policy_blocks:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    if (policy?.loginWallPolicy === 'block') {
      return ok({
        decision: 'login_wall',
        reason: `domain_login_wall_policy_blocks:${lowerDomain}`,
        domain: lowerDomain,
        url,
      });
    }

    return ok({
      decision: 'allowed',
      reason: 'all_checks_passed',
      domain: lowerDomain,
      url,
    });
  }

  getPolicy(domain: string): DomainPolicy | undefined {
    return this.domainPolicies.get(domain.toLowerCase());
  }

  setPolicy(domain: string, policy: DomainPolicy): void {
    this.domainPolicies.set(domain.toLowerCase(), policy);
  }

  async recordRequest(domain: string): Promise<void> {
    const policy = this.domainPolicies.get(domain.toLowerCase());
    const limiter = this.getOrCreateRateLimiter(policy);
    await limiter.record(domain.toLowerCase());
  }

  private getOrCreateRateLimiter(policy: DomainPolicy | undefined): RateLimiter {
    const config: RateLimitConfig = {
      maxRequestsPerSecond: policy?.rateLimitPerSecond ?? this.defaultRateLimitConfig.maxRequestsPerSecond,
      maxRequestsPerMinute: policy?.rateLimitPerMinute ?? this.defaultRateLimitConfig.maxRequestsPerMinute,
    };

    const key = `${config.maxRequestsPerSecond}:${config.maxRequestsPerMinute}`;
    const existing = this.rateLimiters.get(key);
    if (existing) return existing;

    const limiter = new RateLimiter(config);
    this.rateLimiters.set(key, limiter);
    return limiter;
  }
}

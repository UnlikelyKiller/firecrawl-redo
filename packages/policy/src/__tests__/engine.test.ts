import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine, type DomainPolicy } from '../engine';
import { URLValidator } from '../../../security/src/url-validator';

function makePolicy(overrides: Partial<DomainPolicy> & { domain: string }): DomainPolicy {
  return {
    allowed: true,
    blockedPaths: [],
    allowedPaths: [],
    loginWallPolicy: 'skip',
    captchaPolicy: 'skip',
    browserMode: 'static',
    requiresManualApproval: false,
    allowCloudEscalation: false,
    ...overrides,
  };
}

function makeMap(entries: Array<[string, DomainPolicy]>): Map<string, DomainPolicy> {
  return new Map(entries);
}

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(URLValidator);
  });

  it('blocks domains in the default blocked list', async () => {
    const result = await engine.check('https://instagram.com/some/path');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('blocked_domain');
      expect(result.value.domain).toBe('instagram.com');
    }
  });

  it('blocks subdomains of default blocked domains', async () => {
    const result = await engine.check('https://www.facebook.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('blocked_domain');
    }
  });

  it('allows domains not in the blocked list', async () => {
    const result = await engine.check('https://example.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('allowed');
    }
  });

  it('blocks domains with policy set to allowed=false', async () => {
    const engineWithPolicy = new PolicyEngine(
      URLValidator,
      makeMap([
        ['badcorp.com', makePolicy({ domain: 'badcorp.com', allowed: false })],
      ]),
    );

    const result = await engineWithPolicy.check('https://badcorp.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('blocked_domain');
    }
  });

  it('allows domains with policy set to allowed=true', async () => {
    const engineWithPolicy = new PolicyEngine(
      URLValidator,
      makeMap([
        ['example.com', makePolicy({ domain: 'example.com', allowed: true })],
      ]),
    );

    const result = await engineWithPolicy.check('https://example.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('allowed');
    }
  });

  it('blocks paths matching blocked glob patterns', async () => {
    engine.setPolicy('example.com', makePolicy({
      domain: 'example.com',
      blockedPaths: ['/admin/*', '/private/**'],
    }));

    const result = await engine.check('https://example.com/admin/dashboard');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('path_blocked');
    }
  });

  it('allows paths matching allowlist even if also matching blocklist', async () => {
    engine.setPolicy('example.com', makePolicy({
      domain: 'example.com',
      blockedPaths: ['/api/*'],
      allowedPaths: ['/api/public/*'],
    }));

    const result = await engine.check('https://example.com/api/public/data');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('allowed');
    }
  });

  it('returns login_wall when loginWallPolicy is block', async () => {
    engine.setPolicy('example.com', makePolicy({
      domain: 'example.com',
      loginWallPolicy: 'block',
    }));

    const result = await engine.check('https://example.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('login_wall');
    }
  });

  it('returns captcha_required when captchaPolicy is block', async () => {
    engine.setPolicy('example.com', makePolicy({
      domain: 'example.com',
      captchaPolicy: 'block',
    }));

    const result = await engine.check('https://example.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('captcha_required');
    }
  });

  it('returns manual_approval_required when requiresManualApproval is true', async () => {
    engine.setPolicy('example.com', makePolicy({
      domain: 'example.com',
      requiresManualApproval: true,
    }));

    const result = await engine.check('https://example.com/page');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.decision).toBe('manual_approval_required');
    }
  });

  it('returns error for invalid URLs', async () => {
    const result = await engine.check('not-a-valid-url');
    expect(result.isErr()).toBe(true);
  });

  it('returns error for blocked protocols', async () => {
    const result = await engine.check('ftp://example.com/file');
    expect(result.isErr()).toBe(true);
  });
});
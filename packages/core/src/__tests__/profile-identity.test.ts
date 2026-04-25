import { describe, it, expect } from 'vitest';
import type {
  Profile,
  ProxyRecord,
  ProfileLease,
  ProfileEvent,
  AcquireLeaseInput,
  ReleaseLeaseInput,
  BackendEligibilityResult,
  ProfileBackendType,
  ProfileStatus,
  LeaseStatus,
  LeaseOwnerType,
  ProfileEventType,
  ProxyStatus,
} from '../types/profile-identity';
import type { CrawlXError, CrawlXErrorCode } from '../errors';

describe('profile-identity types', () => {
  it('ProfileBackendType covers expected values', () => {
    const values: ReadonlyArray<ProfileBackendType> = ['local', 'tandem', 'multilogin', 'custom'];
    expect(values).toHaveLength(4);
  });

  it('ProfileStatus covers expected values', () => {
    const values: ReadonlyArray<ProfileStatus> = ['active', 'disabled', 'quarantined', 'cooldown'];
    expect(values).toHaveLength(4);
  });

  it('LeaseStatus covers expected values', () => {
    const values: ReadonlyArray<LeaseStatus> = ['active', 'expired', 'released', 'orphaned'];
    expect(values).toHaveLength(4);
  });

  it('LeaseOwnerType covers expected values', () => {
    const values: ReadonlyArray<LeaseOwnerType> = ['worker', 'agent', 'operator'];
    expect(values).toHaveLength(3);
  });

  it('ProxyStatus covers expected values', () => {
    const values: ReadonlyArray<ProxyStatus> = ['active', 'disabled', 'unhealthy'];
    expect(values).toHaveLength(3);
  });

  it('ProfileEventType covers all audit events', () => {
    const values: ReadonlyArray<ProfileEventType> = [
      'lease_acquired', 'lease_heartbeat', 'lease_released', 'quarantined',
      'backend_attach_started', 'backend_attach_failed',
      'proxy_mismatch', 'operator_handoff', 'operator_resume',
    ];
    expect(values).toHaveLength(9);
  });

  it('Profile interface is structurally complete', () => {
    const profile: Profile = {
      id: 'p-1',
      name: 'Test Profile',
      backendType: 'tandem',
      backend: 'tandem',
      externalProfileId: 'tandem-session-abc',
      sessionPartition: 'workspace-1',
      defaultTabHint: null,
      accountLabel: 'test@example.com',
      tenantId: 'tenant-1',
      proxyId: 'proxy-1',
      locale: 'en-US',
      timezone: 'America/New_York',
      userAgentFamily: 'Chrome',
      browserChannel: 'stable',
      status: 'active',
      capabilitiesJson: { screenshot: true, accessibility_snapshot: true },
      lastHealthcheckAt: new Date(),
      lastUsedAt: null,
      domain: 'example.com',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(profile.backendType).toBe('tandem');
    expect(profile.status).toBe('active');
  });

  it('ProfileLease interface enforces ownership fields', () => {
    const lease: ProfileLease = {
      id: 'l-1',
      profileId: 'p-1',
      ownerJobId: 'j-1',
      workerId: 'worker-1',
      ownerType: 'worker',
      ownerId: 'hostname-a',
      leaseToken: 'tok-abc123',
      status: 'active',
      expiresAt: new Date(Date.now() + 300000),
      lastHeartbeatAt: new Date(),
      releasedAt: null,
      releaseReason: null,
      cooldownUntil: null,
      lastError: null,
      createdAt: new Date(),
    };
    expect(lease.leaseToken).toBe('tok-abc123');
    expect(lease.releasedAt).toBeNull();
  });

  it('AcquireLeaseInput requires ttlSeconds', () => {
    const input: AcquireLeaseInput = {
      profileId: 'p-1',
      jobId: 'j-1',
      workerId: 'w-1',
      ownerType: 'worker',
      ownerId: null,
      ttlSeconds: 300,
    };
    expect(input.ttlSeconds).toBe(300);
  });

  it('ReleaseLeaseInput requires leaseToken for idempotent release', () => {
    const input: ReleaseLeaseInput = {
      leaseId: 'l-1',
      leaseToken: 'tok-abc123',
      reason: 'job_completed',
    };
    expect(input.leaseToken).toBe('tok-abc123');
  });
});

describe('CrawlXError types', () => {
  it('error codes include all Tandem-specific codes', () => {
    const tandemCodes: ReadonlyArray<CrawlXErrorCode> = [
      'TANDEM_NOT_CONFIGURED',
      'TANDEM_UNAVAILABLE',
      'TANDEM_AUTH_FAILED',
      'TANDEM_CAPABILITY_UNSUPPORTED',
      'TANDEM_PROFILE_NOT_FOUND',
      'TANDEM_SESSION_NOT_FOUND',
      'TANDEM_LEASE_CONFLICT',
      'TANDEM_PROXY_MISMATCH',
      'TANDEM_POLICY_DENIED',
    ];
    expect(tandemCodes).toHaveLength(9);
  });

  it('CrawlXError is structurally correct', () => {
    const error: CrawlXError = {
      code: 'LEASE_CONFLICT',
      message: 'Profile already has an active lease',
    };
    expect(error.code).toBe('LEASE_CONFLICT');
  });
});

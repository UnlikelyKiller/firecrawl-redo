import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileIdentityService, type ProfileRepository } from '../service';
import type {
  Profile, ProxyRecord, ProfileLease,
  AcquireLeaseInput, ReleaseLeaseInput, ProfileEvent, ProfileStatus,
} from '@crawlx/core';

// Minimal in-memory repository for testing
function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p-1',
    name: 'Test',
    backendType: 'tandem',
    backend: 'tandem',
    externalProfileId: 'tandem-session-1',
    sessionPartition: 'ws-1',
    defaultTabHint: null,
    accountLabel: null,
    tenantId: 'tenant-1',
    proxyId: 'proxy-1',
    locale: 'en-US',
    timezone: 'UTC',
    userAgentFamily: null,
    browserChannel: null,
    status: 'active',
    capabilitiesJson: null,
    lastHealthcheckAt: null,
    lastUsedAt: null,
    domain: 'example.com',
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProxy(overrides: Partial<ProxyRecord> = {}): ProxyRecord {
  return {
    id: 'proxy-1',
    name: 'Test Proxy',
    provider: 'test',
    proxyUrl: 'http://proxy.example.com:8080',
    authSecretRef: null,
    geoCountry: 'US',
    geoRegion: null,
    timezoneHint: 'UTC',
    status: 'active',
    lastHealthcheckAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLease(overrides: Partial<ProfileLease> = {}): ProfileLease {
  return {
    id: 'l-1',
    profileId: 'p-1',
    ownerJobId: 'j-1',
    workerId: 'w-1',
    ownerType: 'worker',
    ownerId: null,
    leaseToken: 'tok-abc',
    status: 'active',
    expiresAt: new Date(Date.now() + 300000),
    lastHeartbeatAt: new Date(),
    releasedAt: null,
    releaseReason: null,
    cooldownUntil: null,
    lastError: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<ProfileRepository> = {}): ProfileRepository {
  return {
    findProfileById: vi.fn().mockResolvedValue(makeProfile()),
    findActiveLeaseByProfileId: vi.fn().mockResolvedValue(null),
    findProxyById: vi.fn().mockResolvedValue(makeProxy()),
    createLease: vi.fn().mockResolvedValue(makeLease()),
    updateLeaseHeartbeat: vi.fn().mockResolvedValue(undefined),
    releaseLease: vi.fn().mockResolvedValue(undefined),
    updateProfileStatus: vi.fn().mockResolvedValue(undefined),
    createProfileEvent: vi.fn().mockResolvedValue(undefined),
    findOrphanedLeases: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ProfileIdentityService.acquireLease', () => {
  it('returns ok with a lease when profile is active and no existing lease', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);
    const input: AcquireLeaseInput = {
      profileId: 'p-1',
      jobId: 'j-1',
      workerId: 'w-1',
      ownerType: 'worker',
      ownerId: null,
      ttlSeconds: 300,
    };

    const result = await svc.acquireLease(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.profileId).toBe('p-1');
      expect(result.value.status).toBe('active');
    }
    expect(repo.createLease).toHaveBeenCalledOnce();
    expect(repo.createProfileEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'lease_acquired' }),
    );
  });

  it('returns LEASE_CONFLICT when profile already has an active lease', async () => {
    const repo = makeRepo({
      findActiveLeaseByProfileId: vi.fn().mockResolvedValue(makeLease()),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.acquireLease({
      profileId: 'p-1', jobId: 'j-2', workerId: 'w-2', ownerType: 'worker', ownerId: null, ttlSeconds: 300,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('LEASE_CONFLICT');
    }
  });

  it('returns PROFILE_NOT_FOUND when profile does not exist', async () => {
    const repo = makeRepo({
      findProfileById: vi.fn().mockResolvedValue(null),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.acquireLease({
      profileId: 'p-missing', jobId: null, workerId: 'w-1', ownerType: 'worker', ownerId: null, ttlSeconds: 300,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PROFILE_NOT_FOUND');
    }
  });

  it('returns PROFILE_UNAVAILABLE when profile is quarantined', async () => {
    const repo = makeRepo({
      findProfileById: vi.fn().mockResolvedValue(makeProfile({ status: 'quarantined' })),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.acquireLease({
      profileId: 'p-1', jobId: null, workerId: 'w-1', ownerType: 'worker', ownerId: null, ttlSeconds: 300,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PROFILE_UNAVAILABLE');
    }
  });

  it('returns CROSS_TENANT_DENIED when job tenant does not match profile tenant', async () => {
    const repo = makeRepo({
      findProfileById: vi.fn().mockResolvedValue(makeProfile({ tenantId: 'tenant-A' })),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.acquireLease({
      profileId: 'p-1', jobId: 'j-1', workerId: 'w-1',
      ownerType: 'worker', ownerId: null, ttlSeconds: 300,
      tenantId: 'tenant-B',
    } as AcquireLeaseInput & { tenantId?: string });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('CROSS_TENANT_DENIED');
    }
  });
});

describe('ProfileIdentityService.releaseLease', () => {
  it('releases a lease with the correct token', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);
    const input: ReleaseLeaseInput = {
      leaseId: 'l-1',
      leaseToken: 'tok-abc',
      reason: 'job_completed',
    };

    const result = await svc.releaseLease(input, makeLease({ leaseToken: 'tok-abc' }));

    expect(result.isOk()).toBe(true);
    expect(repo.releaseLease).toHaveBeenCalledOnce();
    expect(repo.createProfileEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'lease_released' }),
    );
  });

  it('returns LEASE_TOKEN_INVALID for wrong token', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);

    const result = await svc.releaseLease(
      { leaseId: 'l-1', leaseToken: 'wrong-token', reason: 'job_completed' },
      makeLease({ leaseToken: 'tok-abc' }),
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('LEASE_TOKEN_INVALID');
    }
  });
});

describe('ProfileIdentityService.quarantineProfile', () => {
  it('sets profile status to quarantined and logs event', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);

    const result = await svc.quarantineProfile('p-1', 'backend_attach_failed', 'attach failed 3x');

    expect(result.isOk()).toBe(true);
    expect(repo.updateProfileStatus).toHaveBeenCalledWith('p-1', 'quarantined');
    expect(repo.createProfileEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'quarantined' }),
    );
  });
});

describe('ProfileIdentityService.validateProxyBinding', () => {
  it('returns ok when proxy matches profile and proxy is active', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);

    const result = await svc.validateProxyBinding(makeProfile());

    expect(result.isOk()).toBe(true);
  });

  it('returns PROXY_NOT_FOUND when profile has proxy_id but proxy does not exist', async () => {
    const repo = makeRepo({
      findProxyById: vi.fn().mockResolvedValue(null),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.validateProxyBinding(makeProfile());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PROXY_NOT_FOUND');
    }
  });

  it('returns PROXY_UNHEALTHY when proxy is disabled', async () => {
    const repo = makeRepo({
      findProxyById: vi.fn().mockResolvedValue(makeProxy({ status: 'disabled' })),
    });
    const svc = new ProfileIdentityService(repo);

    const result = await svc.validateProxyBinding(makeProfile());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('PROXY_UNHEALTHY');
    }
  });

  it('returns ok when profile has no proxy assigned', async () => {
    const repo = makeRepo();
    const svc = new ProfileIdentityService(repo);

    const result = await svc.validateProxyBinding(makeProfile({ proxyId: null }));

    expect(result.isOk()).toBe(true);
    expect(repo.findProxyById).not.toHaveBeenCalled();
  });
});

describe('ProfileIdentityService.validateBackendCompatibility', () => {
  it('returns ok for tandem backend with tandem-capable profile', async () => {
    const svc = new ProfileIdentityService(makeRepo());
    const result = await svc.validateBackendCompatibility(makeProfile({ backendType: 'tandem' }), 'tandem');
    expect(result.isOk()).toBe(true);
  });

  it('returns EXTERNAL_BACKEND_NOT_PERMITTED when backend type does not match', async () => {
    const svc = new ProfileIdentityService(makeRepo());
    const result = await svc.validateBackendCompatibility(makeProfile({ backendType: 'local' }), 'tandem');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('EXTERNAL_BACKEND_NOT_PERMITTED');
    }
  });
});

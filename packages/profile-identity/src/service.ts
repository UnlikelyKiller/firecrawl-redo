import { ok, err, type Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import type {
  Profile,
  ProxyRecord,
  ProfileLease,
  ProfileEventType,
  ProfileStatus,
  LeaseOwnerType,
  AcquireLeaseInput,
  ReleaseLeaseInput,
} from '@crawlx/core';
import type { CrawlXError } from '@crawlx/core';

export interface ProfileRepository {
  findProfileById(id: string): Promise<Profile | null>;
  findActiveLeaseByProfileId(id: string): Promise<ProfileLease | null>;
  findProxyById(id: string): Promise<ProxyRecord | null>;
  createLease(data: {
    profileId: string;
    ownerJobId: string | null;
    workerId: string;
    ownerType: LeaseOwnerType;
    ownerId: string | null;
    leaseToken: string;
    ttlSeconds: number;
  }): Promise<ProfileLease>;
  updateLeaseHeartbeat(leaseId: string): Promise<void>;
  releaseLease(leaseId: string, reason: string): Promise<void>;
  updateProfileStatus(profileId: string, status: ProfileStatus): Promise<void>;
  createProfileEvent(data: {
    profileId: string;
    jobId: string | null;
    eventType: ProfileEventType;
    metaJson?: Record<string, unknown> | null;
  }): Promise<void>;
  findOrphanedLeases(): Promise<ProfileLease[]>;
}

export class ProfileIdentityService {
  constructor(private readonly repo: ProfileRepository) {}

  async acquireLease(input: AcquireLeaseInput): Promise<Result<ProfileLease, CrawlXError>> {
    const profile = await this.repo.findProfileById(input.profileId);
    if (!profile) {
      return err({ code: 'PROFILE_NOT_FOUND', message: `Profile ${input.profileId} not found` });
    }

    if (profile.status !== 'active') {
      return err({ code: 'PROFILE_UNAVAILABLE', message: `Profile ${input.profileId} is ${profile.status}` });
    }

    if (input.tenantId != null && profile.tenantId != null && input.tenantId !== profile.tenantId) {
      return err({ code: 'CROSS_TENANT_DENIED', message: 'Profile belongs to a different tenant' });
    }

    const existing = await this.repo.findActiveLeaseByProfileId(input.profileId);
    if (existing) {
      return err({ code: 'LEASE_CONFLICT', message: `Profile ${input.profileId} already has an active lease` });
    }

    const lease = await this.repo.createLease({
      profileId: input.profileId,
      ownerJobId: input.jobId,
      workerId: input.workerId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      leaseToken: randomUUID(),
      ttlSeconds: input.ttlSeconds,
    });

    await this.repo.createProfileEvent({
      profileId: input.profileId,
      jobId: input.jobId,
      eventType: 'lease_acquired',
      metaJson: { leaseId: lease.id, workerId: input.workerId },
    });

    return ok(lease);
  }

  async releaseLease(
    input: ReleaseLeaseInput,
    lease: ProfileLease,
  ): Promise<Result<void, CrawlXError>> {
    if (input.leaseToken !== lease.leaseToken) {
      return err({ code: 'LEASE_TOKEN_INVALID', message: 'Lease token does not match' });
    }

    await this.repo.releaseLease(input.leaseId, input.reason);

    await this.repo.createProfileEvent({
      profileId: lease.profileId,
      jobId: lease.ownerJobId,
      eventType: 'lease_released',
      metaJson: { leaseId: lease.id, reason: input.reason },
    });

    return ok(undefined);
  }

  async quarantineProfile(
    profileId: string,
    eventType: ProfileEventType,
    reason: string,
  ): Promise<Result<void, CrawlXError>> {
    await this.repo.updateProfileStatus(profileId, 'quarantined');

    await this.repo.createProfileEvent({
      profileId,
      jobId: null,
      eventType: 'quarantined',
      metaJson: { trigger: eventType, reason },
    });

    return ok(undefined);
  }

  async validateProxyBinding(profile: Profile): Promise<Result<void, CrawlXError>> {
    if (profile.proxyId == null) {
      return ok(undefined);
    }

    const proxy = await this.repo.findProxyById(profile.proxyId);
    if (!proxy) {
      return err({ code: 'PROXY_NOT_FOUND', message: `Proxy ${profile.proxyId} not found` });
    }

    if (proxy.status !== 'active') {
      return err({ code: 'PROXY_UNHEALTHY', message: `Proxy ${proxy.id} is ${proxy.status}` });
    }

    return ok(undefined);
  }

  async validateBackendCompatibility(
    profile: Profile,
    backendType: string,
  ): Promise<Result<void, CrawlXError>> {
    if (profile.backendType !== backendType) {
      return err({
        code: 'EXTERNAL_BACKEND_NOT_PERMITTED',
        message: `Profile backend type '${profile.backendType}' is not compatible with requested backend '${backendType}'`,
      });
    }

    return ok(undefined);
  }
}

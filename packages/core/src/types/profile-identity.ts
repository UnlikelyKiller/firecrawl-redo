// Shared profile-identity types used across packages.
// The canonical source of truth for profile, proxy, lease, and event shapes.

export type ProfileBackendType = 'local' | 'tandem' | 'multilogin' | 'custom';
export type ProfileStatus = 'active' | 'disabled' | 'quarantined' | 'cooldown';
export type LeaseOwnerType = 'worker' | 'agent' | 'operator';
export type LeaseStatus = 'active' | 'expired' | 'released' | 'orphaned';
export type ProxyStatus = 'active' | 'disabled' | 'unhealthy';

export type ProfileEventType =
  | 'lease_acquired'
  | 'lease_heartbeat'
  | 'lease_released'
  | 'quarantined'
  | 'backend_attach_started'
  | 'backend_attach_failed'
  | 'proxy_mismatch'
  | 'operator_handoff'
  | 'operator_resume';

export interface Profile {
  readonly id: string;
  readonly name: string | null;
  readonly backendType: ProfileBackendType;
  // Legacy field — kept for compat with local_vault profiles
  readonly backend: string;
  readonly externalProfileId: string | null;
  readonly sessionPartition: string | null;
  readonly defaultTabHint: string | null;
  readonly accountLabel: string | null;
  readonly tenantId: string | null;
  readonly proxyId: string | null;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly userAgentFamily: string | null;
  readonly browserChannel: string | null;
  readonly status: ProfileStatus;
  readonly capabilitiesJson: Record<string, unknown> | null;
  readonly lastHealthcheckAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly domain: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProxyRecord {
  readonly id: string;
  readonly name: string;
  readonly provider: string | null;
  readonly proxyUrl: string;
  readonly authSecretRef: string | null;
  readonly geoCountry: string | null;
  readonly geoRegion: string | null;
  readonly timezoneHint: string | null;
  readonly status: ProxyStatus;
  readonly lastHealthcheckAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProfileLease {
  readonly id: string;
  readonly profileId: string;
  readonly ownerJobId: string | null;
  readonly workerId: string;
  readonly ownerType: LeaseOwnerType;
  readonly ownerId: string | null;
  readonly leaseToken: string;
  readonly status: LeaseStatus;
  readonly expiresAt: Date;
  readonly lastHeartbeatAt: Date;
  readonly releasedAt: Date | null;
  readonly releaseReason: string | null;
  readonly cooldownUntil: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
}

export interface ProfileEvent {
  readonly id: string;
  readonly profileId: string;
  readonly jobId: string | null;
  readonly eventType: ProfileEventType;
  readonly metaJson: Record<string, unknown> | null;
  readonly createdAt: Date;
}

// Input for acquiring a new lease
export interface AcquireLeaseInput {
  readonly profileId: string;
  readonly jobId: string | null;
  readonly workerId: string;
  readonly ownerType: LeaseOwnerType;
  readonly ownerId: string | null;
  readonly ttlSeconds: number;
  readonly tenantId?: string | null;
}

// Input for releasing a lease
export interface ReleaseLeaseInput {
  readonly leaseId: string;
  readonly leaseToken: string;
  readonly reason: string;
}

// Result of a backend eligibility check
export interface BackendEligibilityResult {
  readonly eligible: boolean;
  readonly reason: string | null;
  readonly profileId: string | null;
  readonly leaseId: string | null;
}

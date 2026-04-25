export type CapabilityName =
  | "screenshots"
  | "ariaSnapshots"
  | "har"
  | "video"
  | "tracing";

export interface SessionCapabilities {
  readonly screenshots: boolean;
  readonly ariaSnapshots: boolean;
  readonly har: boolean;
  readonly video: boolean;
  readonly tracing: boolean;
}

export interface LeaseOwner {
  readonly workerId: string;
  readonly jobId: string;
}

export interface SessionTarget {
  readonly profileId: string;
  readonly cdpHttpUrl: string;
  readonly wsUrl?: string;
  readonly source: "env" | "local" | "launcher";
  readonly startedByBridge: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type LeaseStatus = "active" | "released" | "expired";

export interface LeaseRecord {
  readonly leaseId: string;
  readonly profileId: string;
  readonly workerId: string;
  readonly jobId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly status: LeaseStatus;
  readonly sessionTarget: SessionTarget;
  readonly requestedCapabilities: ReadonlyArray<CapabilityName>;
  readonly grantedCapabilities: SessionCapabilities;
  readonly releasedAt?: string;
  readonly releaseReason?: "manual" | "expired";
}

export interface AttachRequest {
  readonly profileId?: string;
  readonly workerId?: string;
  readonly jobId?: string;
  readonly requestedCapabilities?: ReadonlyArray<CapabilityName>;
}

export interface ReleaseRequest {
  readonly leaseId?: string;
  readonly jobId?: string;
}

export interface HeartbeatRequest {
  readonly leaseId?: string;
  readonly jobId?: string;
}

export interface AttachResponse {
  readonly leaseId: string;
  readonly profileId: string;
  readonly cdpUrl: string;
  readonly wsEndpoint?: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly proxyAuthExpiresAt?: string;
  readonly capabilities: SessionCapabilities;
}

export interface HealthStatus {
  readonly ok: true;
  readonly bridgeVersion: string;
  readonly activeLeases: number;
  readonly lifecycleConfigured: boolean;
  readonly multiloginReachable: boolean;
}

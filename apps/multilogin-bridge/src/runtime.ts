import type { BridgeConfig } from "./config.js";
import { isProfileAllowed } from "./config.js";
import { LeaseManager } from "./lease-manager.js";
import { MultiloginLifecycleClient } from "./lifecycle.js";
import { buildLeaseProxyQuery } from "./auth.js";
import type {
  AttachRequest,
  AttachResponse,
  CapabilityName,
  HealthStatus,
  LeaseRecord,
  ReleaseRequest,
  SessionCapabilities,
} from "./types.js";

function grantCapabilities(
  allowed: SessionCapabilities,
  requested: ReadonlyArray<CapabilityName>,
): SessionCapabilities {
  if (requested.length === 0) {
    return allowed;
  }

  const selected = new Set(requested);
  return {
    screenshots: allowed.screenshots && selected.has("screenshots"),
    ariaSnapshots: allowed.ariaSnapshots && selected.has("ariaSnapshots"),
    har: allowed.har && selected.has("har"),
    video: allowed.video && selected.has("video"),
    tracing: allowed.tracing && selected.has("tracing"),
  };
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class BridgeRuntime {
  private readonly leases = new LeaseManager();

  constructor(
    private readonly config: BridgeConfig,
    private readonly lifecycle = new MultiloginLifecycleClient(config),
  ) {}

  async attach(request: AttachRequest, origin: string): Promise<AttachResponse> {
    await this.cleanupExpiredLeases();

    if (!request.profileId || !request.workerId || !request.jobId) {
      throw new HttpError(400, "profileId, workerId, and jobId are required");
    }
    if (!isProfileAllowed(this.config, request.profileId)) {
      throw new HttpError(403, "Profile is not allowlisted", { profileId: request.profileId });
    }

    const activeLease = this.leases.getActiveLeaseByProfile(request.profileId);
    if (activeLease) {
      if (activeLease.jobId === request.jobId && activeLease.workerId === request.workerId) {
        return this.toAttachResponse(activeLease, origin);
      }
      throw new HttpError(409, "Profile already has an active lease", {
        leaseId: activeLease.leaseId,
        profileId: activeLease.profileId,
      });
    }

    const requestedCapabilities = request.requestedCapabilities ?? [];
    const grantedCapabilities = grantCapabilities(this.config.allowedCapabilities, requestedCapabilities);
    const sessionTarget = await this.lifecycle.startProfile(request.profileId);
    const lease = this.leases.createLease({
      profileId: request.profileId,
      owner: { workerId: request.workerId, jobId: request.jobId },
      ttlSeconds: this.config.leaseTtlSeconds,
      requestedCapabilities,
      grantedCapabilities,
      sessionTarget,
    });

    return this.toAttachResponse(lease, origin);
  }

  async release(request: ReleaseRequest): Promise<LeaseRecord> {
    await this.cleanupExpiredLeases();

    if (!request.leaseId || !request.jobId) {
      throw new HttpError(400, "leaseId and jobId are required");
    }

    const released = this.leases.release(request.leaseId, request.jobId, "manual");
    if (!released) {
      throw new HttpError(404, "Lease not found");
    }
    if (released === "ownership_mismatch") {
      throw new HttpError(409, "Lease ownership mismatch");
    }

    if (released.sessionTarget.startedByBridge && this.config.stopProfileOnRelease) {
      await this.lifecycle.stopProfile(released.profileId);
    }
    return released;
  }

  async heartbeat(leaseId: string | undefined, jobId: string | undefined): Promise<LeaseRecord> {
    await this.cleanupExpiredLeases();

    if (!leaseId || !jobId) {
      throw new HttpError(400, "leaseId and jobId are required");
    }

    const lease = this.leases.heartbeat(leaseId, jobId, this.config.leaseTtlSeconds);
    if (!lease) {
      const existing = this.leases.getLease(leaseId);
      if (!existing) {
        throw new HttpError(404, "Lease not found");
      }
      if (existing.jobId !== jobId) {
        throw new HttpError(409, "Lease ownership mismatch");
      }
      throw new HttpError(409, "Lease is not active");
    }

    return lease;
  }

  getStatus(leaseId: string | undefined): LeaseRecord {
    if (!leaseId) {
      throw new HttpError(400, "Lease id is required");
    }

    const lease = this.leases.getLease(leaseId);
    if (!lease) {
      throw new HttpError(404, "Lease not found");
    }
    return lease;
  }

  async health(): Promise<HealthStatus> {
    return {
      ok: true,
      bridgeVersion: this.config.version,
      activeLeases: this.leases.listActive().length,
      lifecycleConfigured: this.lifecycle.isConfigured(),
      multiloginReachable: await this.lifecycle.checkReachability(),
    };
  }

  async cleanupExpiredLeases(): Promise<void> {
    const expired = this.leases.expireLeases();
    if (!this.config.stopProfileOnExpiry) {
      return;
    }

    for (const lease of expired) {
      if (lease.sessionTarget.startedByBridge) {
        await this.lifecycle.stopProfile(lease.profileId);
      }
    }
  }

  buildProxyTarget(leaseId: string): { httpUrl: string; wsUrl?: string } {
    const lease = this.getStatus(leaseId);
    if (lease.status !== "active") {
      throw new HttpError(409, "Lease is not active");
    }

    return {
      httpUrl: lease.sessionTarget.cdpHttpUrl,
      ...(lease.sessionTarget.wsUrl ? { wsUrl: lease.sessionTarget.wsUrl } : {}),
    };
  }

  private toAttachResponse(lease: LeaseRecord, origin: string): AttachResponse {
    const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    const query = buildLeaseProxyQuery(lease.leaseId, lease.expiresAt, this.config);
    const cdpUrl = `${base}/cdp/${lease.leaseId}${query}`;
    const wsBase = `${base.replace(/^http/i, "ws")}/cdp/${lease.leaseId}/ws`;
    return {
      leaseId: lease.leaseId,
      profileId: lease.profileId,
      cdpUrl,
      ...(lease.sessionTarget.wsUrl
        ? { wsEndpoint: `${wsBase}${query}` }
        : {}),
      startedAt: lease.createdAt,
      expiresAt: lease.expiresAt,
      ...(query ? { proxyAuthExpiresAt: lease.expiresAt } : {}),
      capabilities: lease.grantedCapabilities,
    } satisfies AttachResponse;
  }
}

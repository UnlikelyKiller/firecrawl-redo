import { randomUUID } from "node:crypto";
import type {
  CapabilityName,
  LeaseOwner,
  LeaseRecord,
  SessionCapabilities,
  SessionTarget,
} from "./types.js";

export interface CreateLeaseInput {
  readonly profileId: string;
  readonly owner: LeaseOwner;
  readonly ttlSeconds: number;
  readonly requestedCapabilities: ReadonlyArray<CapabilityName>;
  readonly grantedCapabilities: SessionCapabilities;
  readonly sessionTarget: SessionTarget;
  readonly now?: Date;
}

export class LeaseManager {
  private readonly leases = new Map<string, LeaseRecord>();
  private readonly activeProfileLeases = new Map<string, string>();

  getActiveLeaseByProfile(profileId: string): LeaseRecord | undefined {
    const leaseId = this.activeProfileLeases.get(profileId);
    return leaseId ? this.leases.get(leaseId) : undefined;
  }

  getLease(leaseId: string): LeaseRecord | undefined {
    return this.leases.get(leaseId);
  }

  listActive(): LeaseRecord[] {
    return Array.from(this.activeProfileLeases.values())
      .map((leaseId) => this.leases.get(leaseId))
      .filter((lease): lease is LeaseRecord => lease !== undefined);
  }

  createLease(input: CreateLeaseInput): LeaseRecord {
    const now = input.now ?? new Date();
    const lease: LeaseRecord = {
      leaseId: randomUUID(),
      profileId: input.profileId,
      workerId: input.owner.workerId,
      jobId: input.owner.jobId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000).toISOString(),
      status: "active",
      sessionTarget: input.sessionTarget,
      requestedCapabilities: [...input.requestedCapabilities],
      grantedCapabilities: input.grantedCapabilities,
    };

    this.leases.set(lease.leaseId, lease);
    this.activeProfileLeases.set(lease.profileId, lease.leaseId);
    return lease;
  }

  heartbeat(leaseId: string, jobId: string, ttlSeconds: number, now = new Date()): LeaseRecord | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease || lease.jobId !== jobId || lease.status !== "active") {
      return undefined;
    }

    const nextLease: LeaseRecord = {
      ...lease,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };
    this.leases.set(leaseId, nextLease);
    return nextLease;
  }

  release(leaseId: string, jobId: string, reason: "manual" | "expired", now = new Date()):
    | LeaseRecord
    | "ownership_mismatch"
    | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease) {
      return undefined;
    }
    if (lease.jobId !== jobId) {
      return "ownership_mismatch";
    }
    if (lease.status !== "active") {
      return lease;
    }

    const released: LeaseRecord = {
      ...lease,
      updatedAt: now.toISOString(),
      status: reason === "expired" ? "expired" : "released",
      releasedAt: now.toISOString(),
      releaseReason: reason,
    };
    this.leases.set(leaseId, released);
    this.activeProfileLeases.delete(lease.profileId);
    return released;
  }

  expireLeases(now = new Date()): LeaseRecord[] {
    const expired: LeaseRecord[] = [];
    for (const lease of this.listActive()) {
      if (new Date(lease.expiresAt).getTime() <= now.getTime()) {
        const released = this.release(lease.leaseId, lease.jobId, "expired", now);
        if (released && released !== "ownership_mismatch") {
          expired.push(released);
        }
      }
    }

    return expired;
  }
}

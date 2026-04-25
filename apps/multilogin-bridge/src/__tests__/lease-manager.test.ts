import { describe, expect, it } from "vitest";
import { LeaseManager } from "../lease-manager.js";

const sessionTarget = {
  profileId: "profile-1",
  cdpHttpUrl: "http://127.0.0.1:9222",
  wsUrl: "ws://127.0.0.1:9222/devtools/browser/test",
  source: "env" as const,
  startedByBridge: false,
};

describe("LeaseManager", () => {
  it("rejects lease contention via active profile lookup", () => {
    const manager = new LeaseManager();
    manager.createLease({
      profileId: "profile-1",
      owner: { workerId: "worker-1", jobId: "job-1" },
      ttlSeconds: 60,
      requestedCapabilities: [],
      grantedCapabilities: {
        screenshots: true,
        ariaSnapshots: false,
        har: false,
        video: false,
        tracing: false,
      },
      sessionTarget,
      now: new Date("2026-04-25T00:00:00.000Z"),
    });

    const active = manager.getActiveLeaseByProfile("profile-1");
    expect(active?.jobId).toBe("job-1");
    expect(manager.listActive()).toHaveLength(1);
  });

  it("extends expiry on heartbeat for the owning job", () => {
    const manager = new LeaseManager();
    const lease = manager.createLease({
      profileId: "profile-1",
      owner: { workerId: "worker-1", jobId: "job-1" },
      ttlSeconds: 60,
      requestedCapabilities: [],
      grantedCapabilities: {
        screenshots: true,
        ariaSnapshots: false,
        har: false,
        video: false,
        tracing: false,
      },
      sessionTarget,
      now: new Date("2026-04-25T00:00:00.000Z"),
    });

    const heartbeat = manager.heartbeat(
      lease.leaseId,
      "job-1",
      60,
      new Date("2026-04-25T00:00:30.000Z"),
    );

    expect(heartbeat?.expiresAt).toBe("2026-04-25T00:01:30.000Z");
  });

  it("enforces release ownership", () => {
    const manager = new LeaseManager();
    const lease = manager.createLease({
      profileId: "profile-1",
      owner: { workerId: "worker-1", jobId: "job-1" },
      ttlSeconds: 60,
      requestedCapabilities: [],
      grantedCapabilities: {
        screenshots: true,
        ariaSnapshots: false,
        har: false,
        video: false,
        tracing: false,
      },
      sessionTarget,
      now: new Date("2026-04-25T00:00:00.000Z"),
    });

    const mismatch = manager.release(
      lease.leaseId,
      "job-2",
      "manual",
      new Date("2026-04-25T00:00:10.000Z"),
    );
    expect(mismatch).toBe("ownership_mismatch");

    const released = manager.release(
      lease.leaseId,
      "job-1",
      "manual",
      new Date("2026-04-25T00:00:10.000Z"),
    );

    expect(released).toMatchObject({
      status: "released",
      releaseReason: "manual",
      releasedAt: "2026-04-25T00:00:10.000Z",
    });
    expect(manager.getActiveLeaseByProfile("profile-1")).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrphanReconciler } from '../reconciler';
import type { OrphanReconcilerRepository } from '../reconciler';
import type { ProfileLease } from '@crawlx/core';

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
    expiresAt: new Date(Date.now() - 60000),
    lastHeartbeatAt: new Date(Date.now() - 120000),
    releasedAt: null,
    releaseReason: null,
    cooldownUntil: null,
    lastError: null,
    createdAt: new Date(Date.now() - 300000),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<OrphanReconcilerRepository> = {}): OrphanReconcilerRepository {
  return {
    findOrphanedLeases: vi.fn().mockResolvedValue([]),
    markLeaseOrphaned: vi.fn().mockResolvedValue(undefined),
    createProfileEvent: vi.fn().mockResolvedValue(undefined),
    updateProfileStatus: vi.fn().mockResolvedValue(undefined),
    countOrphanedLeasesByProfile: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('OrphanReconciler.reconcile', () => {
  it('does nothing when there are no orphaned leases', async () => {
    const repo = makeRepo();
    const reconciler = new OrphanReconciler(repo);

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(0);
    expect(result.quarantined).toBe(0);
    expect(repo.markLeaseOrphaned).not.toHaveBeenCalled();
  });

  it('marks orphaned leases and emits events', async () => {
    const lease = makeLease({ id: 'l-orphan', profileId: 'p-1' });
    const repo = makeRepo({
      findOrphanedLeases: vi.fn().mockResolvedValue([lease]),
    });
    const reconciler = new OrphanReconciler(repo);

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(1);
    expect(repo.markLeaseOrphaned).toHaveBeenCalledWith('l-orphan');
    expect(repo.createProfileEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'p-1',
        eventType: 'lease_released',
        metaJson: expect.objectContaining({ reason: 'orphaned_recovery' }),
      }),
    );
  });

  it('quarantines a profile when its orphan count meets the threshold', async () => {
    const lease = makeLease({ id: 'l-orphan', profileId: 'p-quarantine' });
    const repo = makeRepo({
      findOrphanedLeases: vi.fn().mockResolvedValue([lease]),
      countOrphanedLeasesByProfile: vi.fn().mockResolvedValue(3),
    });
    const reconciler = new OrphanReconciler(repo, { quarantineThreshold: 3 });

    const result = await reconciler.reconcile();

    expect(result.quarantined).toBe(1);
    expect(repo.updateProfileStatus).toHaveBeenCalledWith('p-quarantine', 'quarantined');
    expect(repo.createProfileEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'p-quarantine',
        eventType: 'quarantined',
      }),
    );
  });

  it('does not quarantine when orphan count is below threshold', async () => {
    const lease = makeLease({ id: 'l-orphan', profileId: 'p-1' });
    const repo = makeRepo({
      findOrphanedLeases: vi.fn().mockResolvedValue([lease]),
      countOrphanedLeasesByProfile: vi.fn().mockResolvedValue(1),
    });
    const reconciler = new OrphanReconciler(repo, { quarantineThreshold: 3 });

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(1);
    expect(result.quarantined).toBe(0);
    expect(repo.updateProfileStatus).not.toHaveBeenCalled();
  });

  it('processes multiple orphaned leases independently', async () => {
    const leases = [
      makeLease({ id: 'l-1', profileId: 'p-1' }),
      makeLease({ id: 'l-2', profileId: 'p-2' }),
      makeLease({ id: 'l-3', profileId: 'p-3' }),
    ];
    const repo = makeRepo({
      findOrphanedLeases: vi.fn().mockResolvedValue(leases),
      countOrphanedLeasesByProfile: vi.fn().mockResolvedValue(5),
    });
    const reconciler = new OrphanReconciler(repo, { quarantineThreshold: 3 });

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(3);
    expect(result.quarantined).toBe(3);
    expect(repo.markLeaseOrphaned).toHaveBeenCalledTimes(3);
    expect(repo.updateProfileStatus).toHaveBeenCalledTimes(3);
  });

  it('continues processing even if one lease fails', async () => {
    const leases = [
      makeLease({ id: 'l-bad', profileId: 'p-bad' }),
      makeLease({ id: 'l-good', profileId: 'p-good' }),
    ];
    const repo = makeRepo({
      findOrphanedLeases: vi.fn().mockResolvedValue(leases),
      markLeaseOrphaned: vi.fn()
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValue(undefined),
    });
    const reconciler = new OrphanReconciler(repo);

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(repo.markLeaseOrphaned).toHaveBeenCalledTimes(2);
  });
});

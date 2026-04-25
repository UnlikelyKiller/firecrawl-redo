import type { ProfileLease, ProfileEventType, ProfileStatus } from '@crawlx/core';

export interface OrphanReconcilerRepository {
  findOrphanedLeases(): Promise<ProfileLease[]>;
  markLeaseOrphaned(leaseId: string): Promise<void>;
  createProfileEvent(data: {
    profileId: string;
    jobId: string | null;
    eventType: ProfileEventType;
    metaJson?: Record<string, unknown> | null;
  }): Promise<void>;
  updateProfileStatus(profileId: string, status: ProfileStatus): Promise<void>;
  countOrphanedLeasesByProfile(profileId: string): Promise<number>;
}

export interface OrphanReconcilerOptions {
  readonly quarantineThreshold?: number;
}

export interface ReconcileResult {
  readonly processed: number;
  readonly quarantined: number;
  readonly errors: number;
}

export class OrphanReconciler {
  private readonly quarantineThreshold: number;

  constructor(
    private readonly repo: OrphanReconcilerRepository,
    options: OrphanReconcilerOptions = {},
  ) {
    this.quarantineThreshold = options.quarantineThreshold ?? 5;
  }

  async reconcile(): Promise<ReconcileResult> {
    const orphans = await this.repo.findOrphanedLeases();
    let processed = 0;
    let quarantined = 0;
    let errors = 0;

    for (const lease of orphans) {
      try {
        await this.repo.markLeaseOrphaned(lease.id);
        await this.repo.createProfileEvent({
          profileId: lease.profileId,
          jobId: lease.ownerJobId,
          eventType: 'lease_released',
          metaJson: { leaseId: lease.id, reason: 'orphaned_recovery', workerId: lease.workerId },
        });
        processed++;

        const orphanCount = await this.repo.countOrphanedLeasesByProfile(lease.profileId);
        if (orphanCount >= this.quarantineThreshold) {
          await this.repo.updateProfileStatus(lease.profileId, 'quarantined');
          await this.repo.createProfileEvent({
            profileId: lease.profileId,
            jobId: null,
            eventType: 'quarantined',
            metaJson: { trigger: 'orphan_threshold_exceeded', orphanCount, threshold: this.quarantineThreshold },
          });
          quarantined++;
        }
      } catch {
        errors++;
      }
    }

    return { processed, quarantined, errors };
  }
}

import { describe, it, expect } from 'vitest';
import { crawlJobs } from '../schema/jobs';
import { pages } from '../schema/pages';
import { engineAttempts } from '../schema/engine-attempts';
import { agentJobs } from '../schema/agent-jobs';
import { browserProfileLeases } from '../schema/browser-profile-leases';
import { browserProfiles } from '../schema/browser-profiles';
import { domainPolicies } from '../schema/domain_policies';
import { watchJobs } from '../schema/watch-jobs';
import { webhookSubscriptions } from '../schema/webhook-subscriptions';
import { webhookDeliveries } from '../schema/webhook-deliveries';

// Re-import from the index to verify re-exports work
import {
  crawlJobs as crawlJobsReExported,
  pages as pagesReExported,
  engineAttempts as engineAttemptsReExported,
  agentJobs as agentJobsReExported,
  browserProfileLeases as browserProfileLeasesReExported,
  browserProfiles as browserProfilesReExported,
  domainPolicies as domainPoliciesReExported,
  watchJobs as watchJobsReExported,
  webhookSubscriptions as webhookSubscriptionsReExported,
  webhookDeliveries as webhookDeliveriesReExported,
} from '../index';

// Drizzle pgTable objects expose their column map via enumerable properties
// that have a `name` field. We extract column names to verify schema structure.

function getColumnNames(table: Record<string, unknown>): string[] {
  return Object.keys(table).filter(
    (key) => typeof table[key] === 'object' && table[key] !== null && 'name' in (table[key] as Record<string, unknown>)
  );
}

describe('Schema exports', () => {
  it('crawlJobs is defined and re-exported from index', () => {
    expect(crawlJobs).toBeDefined();
    expect(crawlJobsReExported).toBeDefined();
  });

  it('pages is defined and re-exported from index', () => {
    expect(pages).toBeDefined();
    expect(pagesReExported).toBeDefined();
  });

  it('engineAttempts is defined and re-exported from index', () => {
    expect(engineAttempts).toBeDefined();
    expect(engineAttemptsReExported).toBeDefined();
  });

  it('agentJobs is defined and re-exported from index', () => {
    expect(agentJobs).toBeDefined();
    expect(agentJobsReExported).toBeDefined();
  });

  it('browserProfiles is defined and re-exported from index', () => {
    expect(browserProfiles).toBeDefined();
    expect(browserProfilesReExported).toBeDefined();
  });

  it('browserProfileLeases is defined and re-exported from index', () => {
    expect(browserProfileLeases).toBeDefined();
    expect(browserProfileLeasesReExported).toBeDefined();
  });

  it('domainPolicies is defined and re-exported from index', () => {
    expect(domainPolicies).toBeDefined();
    expect(domainPoliciesReExported).toBeDefined();
  });

  it('watchJobs is defined and re-exported from index', () => {
    expect(watchJobs).toBeDefined();
    expect(watchJobsReExported).toBeDefined();
  });

  it('webhookSubscriptions is defined and re-exported from index', () => {
    expect(webhookSubscriptions).toBeDefined();
    expect(webhookSubscriptionsReExported).toBeDefined();
  });

  it('webhookDeliveries is defined and re-exported from index', () => {
    expect(webhookDeliveries).toBeDefined();
    expect(webhookDeliveriesReExported).toBeDefined();
  });
});

describe('crawlJobs table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(crawlJobs as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('type');
    expect(columns).toContain('url');
    expect(columns).toContain('status');
    expect(columns).toContain('error');
    expect(columns).toContain('payload');
    expect(columns).toContain('createdAt');
  });
});

describe('pages table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(pages as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('jobId');
    expect(columns).toContain('canonicalUrl');
    expect(columns).toContain('normalizedUrl');
    expect(columns).toContain('statusCode');
    expect(columns).toContain('contentType');
    expect(columns).toContain('markdownHash');
    expect(columns).toContain('rawHtmlHash');
    expect(columns).toContain('renderedHtmlHash');
    expect(columns).toContain('screenshotHash');
    expect(columns).toContain('createdAt');
  });
});

describe('engineAttempts table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(engineAttempts as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('jobId');
    expect(columns).toContain('engineName');
    expect(columns).toContain('status');
    expect(columns).toContain('error');
    expect(columns).toContain('latencyMs');
    expect(columns).toContain('createdAt');
  });
});

describe('agentJobs table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(agentJobs as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('jobId');
    expect(columns).toContain('prompt');
    expect(columns).toContain('status');
    expect(columns).toContain('steps');
  });
});

describe('browserProfiles table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(browserProfiles as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('domain');
    expect(columns).toContain('backend');
    expect(columns).toContain('encryptedProfile');
    expect(columns).toContain('externalProfileId');
    expect(columns).toContain('externalProfileLabel');
    expect(columns).toContain('bridgeTarget');
    expect(columns).toContain('automationType');
    expect(columns).toContain('profileKind');
    expect(columns).toContain('expiresAt');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });
});

describe('browserProfileLeases table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(browserProfileLeases as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('profileId');
    expect(columns).toContain('ownerJobId');
    expect(columns).toContain('workerId');
    expect(columns).toContain('status');
    expect(columns).toContain('expiresAt');
    expect(columns).toContain('lastHeartbeatAt');
    expect(columns).toContain('cooldownUntil');
    expect(columns).toContain('lastError');
    expect(columns).toContain('createdAt');
  });
});

describe('domainPolicies table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(domainPolicies as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('domain');
    expect(columns).toContain('action');
    expect(columns).toContain('robotsTxt');
    expect(columns).toContain('rateLimit');
    expect(columns).toContain('pathPatterns');
    expect(columns).toContain('maxDepth');
    expect(columns).toContain('browserMode');
    expect(columns).toContain('sessionBackend');
    expect(columns).toContain('requiresNamedProfile');
    expect(columns).toContain('requiresManualApproval');
    expect(columns).toContain('allowCloudEscalation');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });
});

describe('watchJobs table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(watchJobs as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('url');
    expect(columns).toContain('interval');
    expect(columns).toContain('lastRunAt');
  });
});

describe('webhookSubscriptions table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(webhookSubscriptions as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('url');
    expect(columns).toContain('events');
    expect(columns).toContain('secret');
  });
});

describe('webhookDeliveries table', () => {
  it('has expected columns', () => {
    const columns = getColumnNames(webhookDeliveries as unknown as Record<string, unknown>);
    expect(columns).toContain('id');
    expect(columns).toContain('subscriptionId');
    expect(columns).toContain('status');
    expect(columns).toContain('attemptAt');
  });
});

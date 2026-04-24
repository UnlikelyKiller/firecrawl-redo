import { describe, it, expect } from 'vitest';
import { crawlJobs } from '../schema/jobs';
import { pages } from '../schema/pages';
import { engineAttempts } from '../schema/engine-attempts';
import { agentJobs } from '../schema/agent-jobs';
import { browserProfiles } from '../schema/browser-profiles';
import { watchJobs } from '../schema/watch-jobs';
import { webhookSubscriptions } from '../schema/webhook-subscriptions';
import { webhookDeliveries } from '../schema/webhook-deliveries';

// Re-import from the index to verify re-exports work
import {
  crawlJobs as crawlJobsReExported,
  pages as pagesReExported,
  engineAttempts as engineAttemptsReExported,
  agentJobs as agentJobsReExported,
  browserProfiles as browserProfilesReExported,
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
    expect(crawlJobsReExported).toBe(crawlJobs);
  });

  it('pages is defined and re-exported from index', () => {
    expect(pages).toBeDefined();
    expect(pagesReExported).toBe(pages);
  });

  it('engineAttempts is defined and re-exported from index', () => {
    expect(engineAttempts).toBeDefined();
    expect(engineAttemptsReExported).toBe(engineAttempts);
  });

  it('agentJobs is defined and re-exported from index', () => {
    expect(agentJobs).toBeDefined();
    expect(agentJobsReExported).toBe(agentJobs);
  });

  it('browserProfiles is defined and re-exported from index', () => {
    expect(browserProfiles).toBeDefined();
    expect(browserProfilesReExported).toBe(browserProfiles);
  });

  it('watchJobs is defined and re-exported from index', () => {
    expect(watchJobs).toBeDefined();
    expect(watchJobsReExported).toBe(watchJobs);
  });

  it('webhookSubscriptions is defined and re-exported from index', () => {
    expect(webhookSubscriptions).toBeDefined();
    expect(webhookSubscriptionsReExported).toBe(webhookSubscriptions);
  });

  it('webhookDeliveries is defined and re-exported from index', () => {
    expect(webhookDeliveries).toBeDefined();
    expect(webhookDeliveriesReExported).toBe(webhookDeliveries);
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
    expect(columns).toContain('encryptedProfile');
    expect(columns).toContain('expiresAt');
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
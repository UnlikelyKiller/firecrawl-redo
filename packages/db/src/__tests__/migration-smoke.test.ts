import path from 'node:path';
import { describe, beforeAll, afterAll, expect, it } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { startEphemeralPostgres, type EphemeralPostgres } from './helpers/ephemeral-postgres';

type ColumnRecord = {
  column_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

describe.sequential('migration smoke test', () => {
  let dbEnv: EphemeralPostgres;
  let sql: postgres.Sql;

  beforeAll(async () => {
    dbEnv = await startEphemeralPostgres();
    sql = dbEnv.sql;

    const db = drizzle(sql);
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), 'drizzle'),
    });
  }, 60_000);

  afterAll(async () => {
    await dbEnv?.stop();
  });

  it('applies the Multilogin schema changes to browser_profiles', async () => {
    const columns = await sql<ColumnRecord[]>`
      select
        column_name,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'browser_profiles'
        and column_name in (
          'backend',
          'encrypted_profile',
          'external_profile_id',
          'external_profile_label',
          'bridge_target',
          'automation_type',
          'profile_kind',
          'created_at',
          'updated_at'
        )
    `;

    expect(columns).toHaveLength(9);

    const byName = new Map(columns.map((column) => [column.column_name, column]));

    expect(byName.get('backend')).toMatchObject({
      is_nullable: 'NO',
    });
    expect(byName.get('backend')?.column_default).toContain('local_vault');
    expect(byName.get('encrypted_profile')).toMatchObject({
      is_nullable: 'YES',
    });
    expect(byName.get('created_at')).toMatchObject({
      is_nullable: 'NO',
    });
    expect(byName.get('created_at')?.column_default).toContain('now()');
    expect(byName.get('updated_at')).toMatchObject({
      is_nullable: 'NO',
    });
    expect(byName.get('updated_at')?.column_default).toContain('now()');
  });

  it('applies the Multilogin domain policy defaults', async () => {
    const [policy] = await sql<{
      action: string;
      browser_mode: string;
      session_backend: string;
      requires_named_profile: boolean;
      requires_manual_approval: boolean;
      allow_cloud_escalation: boolean;
      created_at: Date | null;
    }[]>`
      insert into domain_policies (domain)
      values ('example.com')
      returning
        action,
        browser_mode,
        session_backend,
        requires_named_profile,
        requires_manual_approval,
        allow_cloud_escalation,
        created_at
    `;

    expect(policy).toBeDefined();
    if (!policy) {
      throw new Error('Expected inserted domain policy to be returned.');
    }

    expect(policy).toMatchObject({
      action: 'allow',
      browser_mode: 'static',
      session_backend: 'crawlx_local',
      requires_named_profile: false,
      requires_manual_approval: false,
      allow_cloud_escalation: false,
    });
    expect(policy.created_at).not.toBeNull();
  });

  it('creates and enforces the browser_profile_leases table relationships', async () => {
    const [job] = await sql<{ id: string }[]>`
      insert into crawl_jobs (type, url, status, payload)
      values ('SCRAPE', 'https://example.com', 'QUEUED', '{}'::jsonb)
      returning id
    `;

    expect(job).toBeDefined();
    if (!job) {
      throw new Error('Expected inserted crawl job to be returned.');
    }

    const [profile] = await sql<{
      id: string;
      backend: string;
      encrypted_profile: string | null;
      created_at: string;
      updated_at: string;
    }[]>`
      insert into browser_profiles (domain, expires_at)
      values ('example.com', now() + interval '1 day')
      returning id, backend, encrypted_profile, created_at, updated_at
    `;

    expect(profile).toBeDefined();
    if (!profile) {
      throw new Error('Expected inserted browser profile to be returned.');
    }

    expect(profile.backend).toBe('local_vault');
    expect(profile.encrypted_profile).toBeNull();
    expect(profile.created_at).toEqual(expect.any(String));
    expect(profile.updated_at).toEqual(expect.any(String));

    const [lease] = await sql<{
      profile_id: string;
      owner_job_id: string | null;
      status: string;
    }[]>`
      insert into browser_profile_leases (profile_id, owner_job_id, worker_id, expires_at)
      values (${profile.id}, ${job.id}, 'worker-1', now() + interval '5 minutes')
      returning profile_id, owner_job_id, status
    `;

    expect(lease).toMatchObject({
      profile_id: profile.id,
      owner_job_id: job.id,
      status: 'active',
    });

    await expect(
      sql`
        insert into browser_profile_leases (profile_id, worker_id, expires_at)
        values ('00000000-0000-0000-0000-000000000000', 'worker-2', now() + interval '5 minutes')
      `,
    ).rejects.toThrow(/browser_profile_leases_profile_id_browser_profiles_id_fk/i);
  });

  it('adds profile identity columns to browser_profiles', async () => {
    const columns = await sql<ColumnRecord[]>`
      select column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'browser_profiles'
        and column_name in (
          'name', 'backend_type', 'session_partition', 'default_tab_hint',
          'account_label', 'tenant_id', 'proxy_id', 'locale', 'timezone',
          'user_agent_family', 'browser_channel', 'status',
          'capabilities_json', 'last_healthcheck_at', 'last_used_at'
        )
    `;
    expect(columns).toHaveLength(15);
    const byName = new Map(columns.map((c) => [c.column_name, c]));
    expect(byName.get('backend_type')).toMatchObject({ is_nullable: 'NO' });
    expect(byName.get('backend_type')?.column_default).toContain('local');
    expect(byName.get('status')).toMatchObject({ is_nullable: 'NO' });
    expect(byName.get('status')?.column_default).toContain('active');
    expect(byName.get('proxy_id')).toMatchObject({ is_nullable: 'YES' });
  });

  it('adds ownership columns to browser_profile_leases', async () => {
    const columns = await sql<ColumnRecord[]>`
      select column_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'browser_profile_leases'
        and column_name in ('owner_type', 'owner_id', 'lease_token', 'released_at', 'release_reason')
    `;
    expect(columns).toHaveLength(5);
    const byName = new Map(columns.map((c) => [c.column_name, c]));
    expect(byName.get('owner_type')).toMatchObject({ is_nullable: 'NO' });
    expect(byName.get('owner_type')?.column_default).toContain('worker');
    expect(byName.get('owner_id')).toMatchObject({ is_nullable: 'YES' });
    expect(byName.get('released_at')).toMatchObject({ is_nullable: 'YES' });
  });

  it('enforces one active lease per profile via partial unique index', async () => {
    const [profile] = await sql<{ id: string }[]>`
      insert into browser_profiles (domain, expires_at)
      values ('lease-test.com', now() + interval '1 day')
      returning id
    `;
    if (!profile) throw new Error('Expected profile');

    await sql`
      insert into browser_profile_leases (profile_id, worker_id, expires_at)
      values (${profile.id}, 'worker-a', now() + interval '5 minutes')
    `;

    await expect(
      sql`
        insert into browser_profile_leases (profile_id, worker_id, expires_at)
        values (${profile.id}, 'worker-b', now() + interval '5 minutes')
      `,
    ).rejects.toThrow(/one_active_lease_per_profile/i);
  });

  it('creates the proxies table with expected defaults', async () => {
    const [proxy] = await sql<{
      name: string;
      status: string;
      created_at: Date;
    }[]>`
      insert into proxies (name, proxy_url)
      values ('test-proxy', 'http://proxy.example.com:8080')
      returning name, status, created_at
    `;
    expect(proxy).toBeDefined();
    if (!proxy) throw new Error('Expected proxy');
    expect(proxy.status).toBe('active');
    expect(proxy.created_at).toBeDefined();
  });

  it('creates the profile_events table and enforces FK to browser_profiles', async () => {
    const [profile] = await sql<{ id: string }[]>`
      insert into browser_profiles (domain, expires_at)
      values ('events-test.com', now() + interval '1 day')
      returning id
    `;
    if (!profile) throw new Error('Expected profile');

    const [event] = await sql<{ event_type: string; profile_id: string }[]>`
      insert into profile_events (profile_id, event_type)
      values (${profile.id}, 'lease_acquired')
      returning event_type, profile_id
    `;
    expect(event).toMatchObject({ event_type: 'lease_acquired', profile_id: profile.id });

    await expect(
      sql`
        insert into profile_events (profile_id, event_type)
        values ('00000000-0000-0000-0000-000000000000', 'lease_acquired')
      `,
    ).rejects.toThrow(/profile_events_profile_id_browser_profiles_id_fk/i);
  });

  it('adds external backend policy columns to domain_policies with false defaults', async () => {
    const [policy] = await sql<{
      allows_external_browser_backend: boolean;
      requires_human_session: boolean;
      requires_operator_handoff: boolean;
    }[]>`
      insert into domain_policies (domain)
      values ('ext-policy-test.com')
      returning allows_external_browser_backend, requires_human_session, requires_operator_handoff
    `;
    expect(policy).toBeDefined();
    if (!policy) throw new Error('Expected policy');
    expect(policy).toMatchObject({
      allows_external_browser_backend: false,
      requires_human_session: false,
      requires_operator_handoff: false,
    });
  });
});

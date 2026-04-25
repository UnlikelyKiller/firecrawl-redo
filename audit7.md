# Audit 7: Tandem + Profile Identity Implementation Status

Date: 2026-04-25
Scope: verify whether the updated Tandem and profile-identity plan is implemented in code, not just documented

## Findings

- High: Tandem is not wired into the queued/runtime job path, so the new preferred external backend is not actually reachable end to end. The worker only accepts `MultiloginOptions`, only imports `MultiloginCdpEngine`, and only builds Multilogin eligibility/engine branches in `buildEngines()`. There is no corresponding Tandem config or routing path in the worker. See [worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:9), [worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:19), [worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:172), [worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:196).

- High: the policy engine still hardcodes the old Multilogin-only requirement model, so the updated `tandem_required` / `session_backend=tandem` policy described in the plan cannot be expressed or enforced consistently at runtime. `DomainPolicy.browserMode` and `sessionBackend` still exclude Tandem in their types, and the only mandatory-backend branch is `multilogin_required` / `multilogin`. See [engine.ts](/C:/dev/firecrawl-redo/packages/policy/src/engine.ts:46), [engine.ts](/C:/dev/firecrawl-redo/packages/policy/src/engine.ts:47), [engine.ts](/C:/dev/firecrawl-redo/packages/policy/src/engine.ts:168), [engine.ts](/C:/dev/firecrawl-redo/packages/policy/src/engine.ts:179).

- Medium: the domain-policy API surface does not round-trip the new external-backend fields that now exist in the DB schema. The route mapper and write paths still only expose `browser_mode`, `session_backend`, `requires_named_profile`, `requires_manual_approval`, and `allow_cloud_escalation`; they do not expose or accept `allows_external_browser_backend`, `requires_human_session`, or `requires_operator_handoff`. See [domains.ts](/C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/domains.ts:18), [domains.ts](/C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/domains.ts:59), [domains.ts](/C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/domains.ts:104), [domains.ts](/C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/domains.ts:160). The schema does contain those fields, so the mismatch is API-level, not DB-level. See [domain_policies.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/domain_policies.ts:13), [domain_policies.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/domain_policies.ts:18).

- Medium: the profile-identity layer exists, but it is not integrated into the runtime paths that choose and attach external backends. `ProfileIdentityService` and `OrphanReconciler` are implemented in their own package, but the only usages I found are package-local tests; the worker path still constructs backend engines directly instead of resolving a profile, validating proxy/backend compatibility, and acquiring a lease through the service. See [service.ts](/C:/dev/firecrawl-redo/packages/profile-identity/src/service.ts:40), [reconciler.ts](/C:/dev/firecrawl-redo/packages/profile-identity/src/reconciler.ts:26), [worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:172).

- Medium: the Tandem engine exists, but it is still a low-level attach/scrape/release component rather than a fully integrated backend. It directly expects `baseUrl`, `tandemProfileId`, and `apiToken`, probes `/health`, calls `/session/attach`, and then attaches via CDP, but there is no matching API/job/policy plumbing that feeds those options from domain policy and profile identity. See [tandem-browser.ts](/C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/tandem-browser.ts:18), [tandem-browser.ts](/C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/tandem-browser.ts:90), [tandem-browser.ts](/C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/tandem-browser.ts:107), [tandem-browser.ts](/C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/tandem-browser.ts:243).

## What Is Implemented

- The DB/schema side of the profile-identity work is materially present:
  - `browser_profiles` has backend, proxy, tenant, session-partition, and status fields. See [browser-profiles.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/browser-profiles.ts:6).
  - `browser_profile_leases` has ownership, lease token, partial unique index, and cooldown/error fields. See [browser-profile-leases.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/browser-profile-leases.ts:7).
  - `proxies` and `profile_events` tables exist. See [proxies.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/proxies.ts:3) and [profile-events.ts](/C:/dev/firecrawl-redo/packages/db/src/schema/profile-events.ts:5).

- Migration smoke coverage for the new schema is present and materially better than earlier rounds. The tests cover clean migration application, lease-table FK/index behavior, `proxies`, `profile_events`, and the new domain-policy columns. See [migration-smoke.test.ts](/C:/dev/firecrawl-redo/packages/db/src/__tests__/migration-smoke.test.ts:113), [migration-smoke.test.ts](/C:/dev/firecrawl-redo/packages/db/src/__tests__/migration-smoke.test.ts:193), [migration-smoke.test.ts](/C:/dev/firecrawl-redo/packages/db/src/__tests__/migration-smoke.test.ts:230), [migration-smoke.test.ts](/C:/dev/firecrawl-redo/packages/db/src/__tests__/migration-smoke.test.ts:246), [migration-smoke.test.ts](/C:/dev/firecrawl-redo/packages/db/src/__tests__/migration-smoke.test.ts:272).

- The Tandem engine itself is implemented as a real engine, not just a TODO. It supports health probe, attach, heartbeat, CDP connect, scrape, and release. See [tandem-browser.ts](/C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/tandem-browser.ts:55).

- The profile-identity package is implemented as real code with tests for lease acquisition, release, proxy validation, backend compatibility, and orphan reconciliation. See [service.test.ts](/C:/dev/firecrawl-redo/packages/profile-identity/src/__tests__/service.test.ts:91) and [reconciler.test.ts](/C:/dev/firecrawl-redo/packages/profile-identity/src/__tests__/reconciler.test.ts:38).

## Bottom Line

The updated architecture is only partially implemented.

The strongest completed area is the schema/types/test groundwork for profile identity and the standalone Tandem engine implementation.

The main missing work is the actual runtime integration:

- Tandem is not yet part of the queued job path
- policy still centers on Multilogin-only mandatory backend semantics
- API routes do not round-trip the full new policy model
- profile identity is not yet the runtime source of truth for backend attach

I would not describe the Tandem-first plan as fully implemented yet.

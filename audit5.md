# Multilogin / External Session Backend Audit

Date: 2026-04-25

## Findings

- Low: `apps/multilogin-bridge` is still a scaffold rather than a production-ready bridge. It now enforces single active leases, ownership checks, heartbeat extension, and idempotent re-attach/release, but it still does not implement replay protection, DB-backed lease persistence, or actual CDP proxying/lifecycle mediation. See [apps/multilogin-bridge/src/server.ts](/C:/dev/firecrawl-redo/apps/multilogin-bridge/src/server.ts:1) and [docs/multilogin-bridge-spec.md](/C:/dev/firecrawl-redo/docs/multilogin-bridge-spec.md:1).
- Low: test coverage is still lighter than the risk level of this seam. Security guards are now covered, and the engine/schema surfaces are covered, but there are still no focused tests for API-side `resolveMultiloginRoutePolicy()` behavior, worker-side `resolveEligibility()` integration, or bridge runtime flows. See [apps/api/src/routes/crawlx/v2/multilogin.ts](/C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/multilogin.ts:1), [packages/jobs/src/worker.ts](/C:/dev/firecrawl-redo/packages/jobs/src/worker.ts:1), and [apps/multilogin-bridge/src/server.ts](/C:/dev/firecrawl-redo/apps/multilogin-bridge/src/server.ts:1).
- Low: the DB package still validates schema shape, not actual migration application against a clean database. The corrected foreign key target in [0002_multilogin_external_session.sql](/C:/dev/firecrawl-redo/packages/db/drizzle/0002_multilogin_external_session.sql:1) is now consistent with the schema, but there is still no migration-application test to prove rollout end to end.

## Resolved

- Fixed the broken migration foreign key to target `crawl_jobs` instead of `jobs`.
- Added DB schema support for external session backends, browser profile leases, and richer domain policy fields.
- Stopped injecting Multilogin as a global engine for every request/job; API routes and worker wiring are now eligibility-gated.
- Propagated the Multilogin bridge exception through both URL validation and DNS validation, with tests.
- Fixed domain policy round-tripping for `action`, `max_depth`, and `rate_limit_rpm`.
- Tightened named-profile enforcement so `requires_named_profile` now requires a matching `browser_profiles` binding instead of only a global env var.
- Hardened the bridge scaffold with lease contention checks, ownership checks, heartbeat extension, and idempotent release.

## Verification

Passed:

- `pnpm --filter @crawlx/security test`
- `pnpm --filter @crawlx/db test`
- `pnpm --filter @crawlx/waterfall-engine test`
- `pnpm --filter @crawlx/jobs typecheck`
- `pnpm --dir apps/api build`
- `pnpm --dir apps/multilogin-bridge typecheck`
- `changeguard verify`

Not performed:

- full workspace test suite
- migration-application test on a clean database
- end-to-end Multilogin bridge / CDP integration test

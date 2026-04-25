# Audit 6

Date: 2026-04-25

## Scope

Audit of the Multilogin rollout work completed after `audit5.md`, focused on:

- productionizing the bridge beyond scaffold status
- actual CDP proxying and browser attach flow
- job/orchestrator execution through the Multilogin seam
- rollout validation and migration verification
- regression check against the previously identified low-severity findings

## Result

The Multilogin seam is now materially implemented rather than scaffold-only.

Key outcomes verified:

- `apps/multilogin-bridge` now runs as a real authenticated lease-aware service, with attach, release, heartbeat, health, lifecycle mediation, and HTTP/WebSocket CDP proxying.
- `packages/waterfall-engine` `MultiloginCdpEngine` now performs a real bridge attach and Playwright `connectOverCDP()` scrape instead of returning `NOT_IMPLEMENTED`.
- `packages/jobs` now routes Multilogin per-job via eligibility/required-domain resolution instead of treating it as an always-on global engine, and it now fails closed if Multilogin eligibility resolution throws.
- `packages/db` now has a clean-db migration smoke test that exercises the Multilogin schema additions and foreign-key wiring.
- The direct-origin live smoke succeeded against `http://localhost:8095` through the bridge and CDP attach path.
- `changeguard verify` passed on the final state.

## Findings

### Resolved

1. Bridge scaffold gap: resolved

- The bridge is no longer doc-only or stub-only.
- It now has lease management, allowlisted profiles, shared-secret auth, lease-scoped proxy auth for CDP paths, expiry cleanup, and lifecycle/health handling.

2. CDP proxy/browser attach gap: resolved

- The prior runtime blocker was Playwright failing bridge-authenticated CDP discovery.
- This is now fixed by issuing lease-scoped proxy URLs and preferring the lease websocket endpoint in the engine attach flow.
- Direct-origin live smoke passed with:
  - bridge on `127.0.0.1:4010`
  - local CDP browser on `127.0.0.1:9223`
  - scrape target `http://localhost:8095`

3. End-to-end job execution gap: resolved at the CrawlX seam level

- Worker/orchestrator code now builds engines per job.
- Required-domain policy can force Multilogin-only execution.
- Optional eligibility can append Multilogin behind standard engines.
- Queued jobs now fail closed if Multilogin eligibility resolution throws instead of being left in `RUNNING`.
- The worker can now honor a resolver-provided `profileId` instead of being limited to one static global profile in the jobs path.
- Package-level tests cover required-domain success, required-but-not-authorized failure, resolver-throw failure, and profile override selection.

4. Migration-application test gap: resolved

- `packages/db/src/__tests__/migration-smoke.test.ts` now provisions ephemeral Postgres in Docker, applies migrations, and validates the new schema state.

5. Thin coverage finding: materially improved

- Added bridge auth tests for lease-scoped proxy tokens.
- Added bridge auth hardening so no-secret mode is only allowed for loopback-only deployments.
- Added worker integration coverage for Multilogin-required routing, resolver failure handling, and profile override behavior.
- Added API route-policy unit coverage for named-profile eligibility resolution.
- Added engine coverage for lease heartbeat behavior during active scrapes.

### Remaining

1. Medium: lease state is still in-memory, not DB-backed at runtime

- The bridge now persists the schema for lease ownership, but the active runtime still uses in-memory lease state.
- A bridge restart still forgets active leases and cooldown state.
- This does not block the implemented runtime path, but it remains the main production-hardening gap.

2. Low: vendor installation is still manual

- The repo now supports the runtime seam, but it does not and should not auto-install proprietary Multilogin/Mimic software.
- Host installation remains an external prerequisite.

3. Low: API Jest ergonomics remain poor

- `apps/api` now builds, and the new Multilogin route-policy test compiles with the app.
- However, the package test script is broad enough that targeted execution still pulls in unrelated suites and repo-local environment assumptions.
- This is an existing test-runner hygiene issue, not a Multilogin runtime blocker.

4. Low: live validation was intentionally limited to direct-origin behavior

- I validated `http://localhost:8095` only.
- I did not attempt to test or tune against `http://mock.localtest.me`, SafeLine, or any anti-bot/WAF bypass path.

## Verification

Passed:

- `pnpm --filter @crawlx/security test`
- `pnpm --filter @crawlx/db test`
- `pnpm --filter @crawlx/db test:migration-smoke`
- `pnpm --filter @crawlx/jobs test`
- `pnpm --filter @crawlx/multilogin-bridge test`
- `pnpm --filter @crawlx/multilogin-bridge typecheck`
- `pnpm --filter @crawlx/multilogin-bridge build`
- `pnpm --filter @crawlx/waterfall-engine test`
- `pnpm --filter @crawlx/waterfall-engine typecheck`
- `pnpm --dir apps/api build`
- `changeguard verify`

Manual runtime validation:

- Successful real scrape through the bridge/CDP path to `http://localhost:8095/`
- Returned title: `SafeLine Mock App`
- Returned HTTP status: `200`

## Bottom Line

This is no longer just a plan plus scaffolding. The bridge, engine, job routing, and migration-validation seams are implemented and verified. The main remaining gaps are operational polish around host-installed vendor software and broader API test-runner hygiene, not missing core Multilogin runtime functionality inside CrawlX.

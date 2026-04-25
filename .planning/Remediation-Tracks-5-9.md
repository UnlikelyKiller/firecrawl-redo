# Remediation Plan: Tracks 5-9

This plan addresses the Material Incompleteness found during the track 0-4 audit, providing specific tasks to complete Tracks 5 through 9 according to the original `Implementation-Plan.md`.

## Plan: Track 5 (Domain Policy + Egress)
### Phase 1: Persistence Layer
- [ ] Task 1.1: Verify `policy_decisions` table exists (`packages/db/src/schema/policy_decisions.ts`) and create `domain_policies.ts` if missing to store rules (rate limits, blockpaths). Implement Drizzle repository queries in `packages/db`.
- [ ] Task 1.2: Set up `Gatekeeper` context to track blocked actions and log them to `policy_decisions`.
### Phase 2: Core Domain Logic
- [ ] Task 2.1: Implement `packages/policy/src/engine.ts` with `PolicyEngine`. Evaluate URLs against `robots.txt`, domain rules, path globs, and rate limits.
- [ ] Task 2.2: Implement `packages/security/src/egress-policy.ts` to combine URL validation, DNS Guarding (blocking private IPs post-resolution), and Secret Redaction.
### Phase 3: API Integration
- [ ] Task 3.1: Fully implement `/v2/crawlx/domains` (`apps/api/src/routes/crawlx/v2/domains.ts`) with GET/PUT to manage domain policies dynamically.
- [ ] Task 3.2: Inject `Gatekeeper` (Policy + Security) middleware into `scrape.route.ts` and `crawl.route.ts` so egress checks run before dispatching jobs.

## Plan: Track 6 (Agent Lite + Search + Webhooks)
### Phase 1: Agent Worker Loop
- [ ] Task 1.1: Create/Update `apps/api/src/routes/crawlx/v2/agent.ts` with `POST /v2/crawlx/agent` to accept an AgentJobConfig payload.
- [ ] Task 1.2: Implement `apps/api/src/workers/agent.worker.ts`. Implement the loop: `plan -> search -> rank -> scrape -> extract -> synthesize -> webhook`.
### Phase 2: Search Provider Integration
- [ ] Task 2.1: Create `packages/search-provider/src/provider.ts` defining the `SearchProvider` contract.
- [ ] Task 2.2: Implement `packages/search-provider/src/searxng.ts` wrapping a SearXNG instance for query resolution.
### Phase 3: Webhook Dispatcher
- [ ] Task 3.1: Implement `packages/webhooks/src/dispatcher.ts`. Add HMAC signatures, retry logic with exponential backoff, and idempotency keys.
- [ ] Task 3.2: Implement `/v2/crawlx/webhooks` router (`apps/api/src/routes/crawlx/v2/webhooks.ts`) for CRUD operations on webhook subscriptions.

## Plan: Track 7 (Dashboard + Activity Logs)
### Phase 1: Activity Logs
- [ ] Task 1.1: Verify `activity_log.ts` table exists.
- [ ] Task 1.2: Implement Express middleware `apps/api/src/middlewares/activityLogger.ts` to log all API requests (timestamp, endpoint, correlation ID, latency) directly to the DB.
### Phase 2: API Endpoints for Dashboard
- [ ] Task 2.1: Implement `/v2/crawlx/stats` (`apps/api/src/routes/crawlx/v2/stats.ts`) returning aggregate statistics, extraction success rates, and active jobs.
- [ ] Task 2.2: Ensure `/v2/crawlx/jobs` and other resource routers query actual DB records instead of mocks.
### Phase 3: UI Integration
- [ ] Task 3.1: Replace mock data fetching in `apps/web` with real fetch calls to `/v2/crawlx/stats`, `/jobs`, and `/activity-log`.
- [ ] Task 3.2: Connect the dashboard Activity Log viewer to the real endpoints.

## Plan: Track 8 (CLI Hardening)
### Phase 1: Fix Unimplemented Commands
- [ ] Task 1.1: Update `apps/cli/src/commands/agent.ts` to communicate with `POST /v2/crawlx/agent` and process the returned results or stream logs.
- [ ] Task 1.2: Update `apps/cli/src/commands/watch.ts` to insert records into the `watch_jobs` table via an API endpoint.
### Phase 2: Better Error Reporting
- [ ] Task 2.1: Add global try-catch wrappers for CLI commands that print structured, human-readable errors with actionable fixes rather than raw stack traces (neverthrow usage).
- [ ] Task 2.2: Implement `crawlx failures` command to group and display failure classes using Drizzle aggregations.

## Plan: Track 9 (Change Tracking + Recrawls)
### Phase 1: Change Tracking Logic
- [ ] Task 1.1: Implement `packages/change-tracking/src/tracker.ts` referencing the `page_snapshots` table.
- [ ] Task 1.2: Implement `hash-diff.ts` and `markdown-diff.ts` to generate structural diffs between two `page_snapshots` based on the content hash.
### Phase 2: Scheduled Recrawl Engine
- [ ] Task 2.1: Build `apps/api/src/workers/watch.worker.ts` to process `watch_jobs` using BullMQ repeatable jobs.
- [ ] Task 2.2: Wire change tracking to `watch.worker.ts`. When differences are detected during a recrawl, dispatch a diff payload via the Webhook system.

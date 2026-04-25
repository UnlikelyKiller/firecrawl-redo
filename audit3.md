# Audit 3

## Summary

This round shows real progress over `audit2.md`:

- `apps/api` now builds cleanly with `pnpm --dir apps/api build`.
- The DB schema mismatches called out in `audit2.md` for `watch_jobs`, `webhook_subscriptions`, and `llm_calls` were addressed.
- The Agent route now uses a dedicated `AgentRequestSchema` and includes a search step.
- Several dashboard pages moved off inline mock datasets and now call the API.

The remaining issues are now mostly runtime/API-contract problems rather than raw compile failures. The strongest blockers are missing CrawlX endpoints that the frontend now depends on, response-shape mismatches between existing routes and frontend types, and engine implementations that are still simulated rather than functional.

## Findings

### High

1. The frontend now depends on CrawlX endpoints that still do not exist in the backend router. `apps/web/src/api/client.ts:78-155` calls `/v2/crawlx/failures`, `/v2/crawlx/failures/groups`, `/v2/crawlx/failures/engines`, `/v2/crawlx/extractions`, `/v2/crawlx/activity`, `/v2/crawlx/usage`, and `/v2/crawlx/receipts`, plus `/v2/crawlx/jobs/:id/replay`. But `apps/api/src/routes/crawlx/v2/index.ts:14-22` mounts only `jobs`, `pages`, `domains`, `webhooks`, `stats`, `health`, `extract`, `agent`, and `watch`. As a result, the new “live” dashboard/API integration is still incomplete at runtime.

2. Several implemented backend routes do not return the shapes the frontend expects. `apps/api/src/routes/crawlx/v2/jobs.ts:8-11` returns `{ jobs: [...] }`, while the frontend expects `JobsResponse = PaginatedResponse<Job>` with a `data` field and pagination metadata (`apps/web/src/types.ts:170-184`, `apps/web/src/api/client.ts:47-57`). `apps/api/src/routes/crawlx/v2/pages.ts:8-11` returns `{ pages: [...] }`, but the frontend expects `PagesResponse = PaginatedResponse<ScrapePage>` (`apps/web/src/types.ts:178-184`, `apps/web/src/api/client.ts:69-76`). This means the build passes, but the UI contract is still broken.

3. The domain policy API contract is still inconsistent between frontend and backend. The frontend uses `POST /v2/crawlx/domains` and `PATCH /v2/crawlx/domains/:domain` (`apps/web/src/api/client.ts:101-117`), but the backend exposes `GET /`, `GET /:domain`, and `PUT /:domain` only (`apps/api/src/routes/crawlx/v2/domains.ts:8-60`). That makes policy creation and update from the dashboard non-functional even though both sides compile.

### Medium

4. Track 9 is still only partially implemented. The watch route accepts `schema` and `webhook` in the request body (`apps/api/src/routes/crawlx/v2/watch.ts:10`), but neither value is stored or used when inserting the watch job (`apps/api/src/routes/crawlx/v2/watch.ts:18-25`). This still falls short of the planned “scheduled recrawls + schema + webhook” behavior.

5. Track 7 is still incomplete across the dashboard. `JobsPage`, `UsagePage`, and `ActivityPage` now fetch live data (`apps/web/src/pages/JobsPage.tsx`, `apps/web/src/pages/UsagePage.tsx`, `apps/web/src/pages/ActivityPage.tsx`), but `JobDetailPage`, `PagesPage`, `FailuresPage`, and `ReceiptsPage` remain mock-backed (`apps/web/src/pages/JobDetailPage.tsx`, `apps/web/src/pages/PagesPage.tsx`, `apps/web/src/pages/FailuresPage.tsx`, `apps/web/src/pages/ReceiptsPage.tsx`). Combined with the missing backend routes above, the dashboard is still only partially real.

6. Some waterfall engines are still simulated rather than implemented. `packages/waterfall-engine/src/engines/crawlx-recipe.ts:16-24` returns a synthetic success body. `packages/waterfall-engine/src/engines/crawlx-branded-browser.ts:16-31` explicitly says it is simulating a realistic scrape result. `packages/waterfall-engine/src/engines/manual-review.ts:13-28` also simulates a queue transition in-process rather than integrating with a manual review system. These are improvements over missing files, but they still do not meet a strict “fully implemented” bar.

### Low

7. The conductor board still overstates completion relative to the actual runtime surface. `conductor/conductor.md:10-19` marks Tracks 0-9 as completed, but the missing endpoints and mismatched contracts above mean the claimed operator/dashboard/API surface is not fully working end-to-end yet.

## Improvements Since Audit 2

- `apps/api` build failure is resolved.
- The previous DB field mismatches for watch/webhook/LLM logging were fixed.
- The agent route is materially better: it now validates with `AgentRequestSchema` and performs search before scrape/extract.
- The dashboard is no longer entirely mock-backed; some pages now call live API methods.

## Verification Performed

- Read the updated CrawlX route files, DB schema files, waterfall engines, web client, and dashboard pages.
- Ran:
  - `pnpm --filter @crawlx/db --filter @crawlx/firecrawl-client --filter @crawlx/firecrawl-compat --filter @crawlx/model-adapter --filter @crawlx/search-provider --filter @crawlx/security --filter @crawlx/waterfall-engine typecheck`
  - `pnpm --filter @crawlx/cli typecheck`
  - `pnpm --filter @crawlx/web typecheck`
  - `pnpm --dir apps/api build`
- Results:
  - All listed typechecks passed.
  - `apps/api` build passed.

## Conclusion

The codebase is in a meaningfully better state than in `audit2.md`. The major compile-time integration regressions are fixed. The remaining blockers are now runtime-level: missing CrawlX endpoints, backend/frontend response-contract mismatches, partially implemented watch behavior, and several pages/engines that still rely on mocks or simulated results. This is closer to “addressed,” but still not at “everything addressed, no regressions, fully implemented” yet.

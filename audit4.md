# Audit 4

Date: 2026-04-24

Scope:
- Re-reviewed `conductor/conductor.md` against the current CrawlX implementation
- Focused on regressions since `audit3.md`
- Checked the current frontend/backend contract for the CrawlX dashboard routes
- Re-checked previously questionable engine implementations

Summary:
- This is materially better than `audit3.md`. The previously missing CrawlX route surface is now present and mounted, `apps/api` builds again, and the Pages/Failures/Receipts/Job Detail views are now backed by real API calls instead of remaining mock-only.
- I would still not sign off on the conductor's "all tracks complete" claim. The remaining issues are concentrated in runtime contract mismatches and partial implementations rather than missing files.

## Findings

### Medium: replay flow is still wired incorrectly end-to-end

The frontend types `POST /v2/crawlx/jobs/:id/replay` as returning a raw `Job`, but the API actually returns `{ success: true, data: Job }`. On top of that, the UI ignores the replay response and immediately re-fetches the original job ID instead of following the newly created replay job. That means the "Replay" button can report success while leaving the user on the old job record with no path to the new replayed job.

Evidence:
- [apps/web/src/api/client.ts](C:/dev/firecrawl-redo/apps/web/src/api/client.ts:64) expects `Promise<Job>` from `replayJob`
- [apps/api/src/routes/crawlx/v2/jobs.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/jobs.ts:119) returns `{ success: true, data: mapJob(newJob) }`
- [apps/web/src/pages/JobDetailPage.tsx](C:/dev/firecrawl-redo/apps/web/src/pages/JobDetailPage.tsx:49) re-fetches `fetchJob(jobId)` after replay instead of navigating to or loading the new job

Why this matters:
- The replay surface exists now, but the current UX is misleading and does not complete the replay workflow correctly.

### Medium: activity API is serving the wrong fields for the dashboard contract

The activity logger writes request details into `metadata` as `method`, `path`, `statusCode`, and `duration`, while the CrawlX activity route reconstructs the response using `row.event`, `row.entityType`, and `meta?.latencyMs`. In practice this yields values like `endpoint: "API_REQUEST"` and `method: "SYSTEM"` instead of the actual HTTP method/path, and latency defaults to `0` because the logger stores `duration`, not `latencyMs`.

Evidence:
- [apps/api/src/middleware/activity-logger.ts](C:/dev/firecrawl-redo/apps/api/src/middleware/activity-logger.ts:13) stores `method`, `path`, `statusCode`, and `duration` in `metadata`
- [apps/api/src/routes/crawlx/v2/activity.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/activity.ts:28) maps `endpoint` from `row.event`, `method` from `row.entityType`, and `latency_ms` from `meta?.latencyMs ?? 0`
- [apps/web/src/pages/ActivityPage.tsx](C:/dev/firecrawl-redo/apps/web/src/pages/ActivityPage.tsx:52) clearly expects real request method, endpoint, response status, and latency columns

Why this matters:
- The page is live now, but the data it shows is not the data the UI contract implies.

### Medium: usage endpoint is still only partially implemented

`/v2/crawlx/usage` now exists, but it only aggregates LLM calls and hardcodes `browser_seconds: 0` and `pages_scraped: 0` for every row. That falls short of the dashboard contract and the plan's broader observability/accounting goals.

Evidence:
- [apps/api/src/routes/crawlx/v2/usage.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/usage.ts:10) aggregates only `llmCalls`
- [apps/api/src/routes/crawlx/v2/usage.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/usage.ts:23) returns `browser_seconds: 0`
- [apps/api/src/routes/crawlx/v2/usage.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/usage.ts:24) returns `pages_scraped: 0`

Why this matters:
- The route is no longer missing, but it is still incomplete as a usage/operations surface.

### Medium: receipts endpoint is present but still only exposes a thin shell of the intended data

The receipts page is no longer mock-backed, but the backend currently returns empty action timelines and no ARIA snapshots for every receipt. It only surfaces a video URL when `videoReceiptHash` exists. That is enough to render a table, but not enough to satisfy a meaningful browser-receipt/audit trail feature.

Evidence:
- [apps/api/src/routes/crawlx/v2/receipts.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/receipts.ts:30) builds the receipt payload
- [apps/api/src/routes/crawlx/v2/receipts.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/receipts.ts:37) sets `aria_snapshot` to `undefined`
- [apps/api/src/routes/crawlx/v2/receipts.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/receipts.ts:38) returns an always-empty `action_timeline`

Why this matters:
- This is better than the earlier missing route, but it is still a partial receipt implementation.

### Low: job detail remains only partially implemented even though the page is now live

`GET /v2/crawlx/jobs/:id` now returns a usable job detail object, but key sections are still hardcoded empty or absent. `artifacts` is always `[]`, `extraction` is always `undefined`, and several top-level job fields remain unset in `mapJob`, including timestamps, engine, and cost.

Evidence:
- [apps/api/src/routes/crawlx/v2/jobs.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/jobs.ts:15) leaves `started_at`, `completed_at`, `engine`, and `cost_cents` unset in `mapJob`
- [apps/api/src/routes/crawlx/v2/jobs.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/jobs.ts:109) returns `artifacts: []`
- [apps/api/src/routes/crawlx/v2/jobs.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/jobs.ts:111) returns `extraction: undefined`

Why this matters:
- The page is no longer mock-only, but it is still not fully populated.

### Low: manual-review is real, but the other added waterfall engines still depend entirely on browser-worker response shaping

This is improved from the earlier stubbed state: `manual-review` is now a proper `PENDING_REVIEW` failure path rather than a synthetic success. The branded-browser and recipe engines are also no longer obvious fake HTML stubs. However, they still rely entirely on browser-worker returning precomputed artifact hashes, and this audit did not find end-to-end verification that those receipt fields are persisted and surfaced back through the dashboard.

Evidence:
- [packages/waterfall-engine/src/engines/manual-review.ts](C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/manual-review.ts:13) now returns a real `PENDING_REVIEW` error
- [packages/waterfall-engine/src/engines/crawlx-branded-browser.ts](C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/crawlx-branded-browser.ts:29) delegates entirely to browser-worker `/scrape`
- [packages/waterfall-engine/src/engines/crawlx-recipe.ts](C:/dev/firecrawl-redo/packages/waterfall-engine/src/engines/crawlx-recipe.ts:31) also delegates entirely to browser-worker `/scrape`

Why this matters:
- This is not a blocker by itself, but it means the conductor's completion claim still rests on runtime paths that are only partially verified from the dashboard outward.

## Resolved Since Audit 3

These earlier findings appear addressed in the current tree:
- The missing CrawlX backend routes are now implemented and mounted under [apps/api/src/routes/crawlx/v2/index.ts](C:/dev/firecrawl-redo/apps/api/src/routes/crawlx/v2/index.ts:1)
- The domain policy surface now supports create/update methods that match the frontend client
- `POST /v2/crawlx/jobs/:id/replay` now exists
- The Pages, Failures, Receipts, and Job Detail frontend views are now API-backed rather than static mocks
- `apps/api` now builds again

## Bottom Line

The repo is much closer than it was in `audit3.md`, and the major route-surface regressions I previously called out are mostly fixed. I still would not mark the conductor as fully satisfied: the replay flow is not wired correctly, the activity contract is wrong, and the usage/receipts/job-detail data is still only partially implemented.

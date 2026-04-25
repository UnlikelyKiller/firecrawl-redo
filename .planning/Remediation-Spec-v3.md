# Remediation Spec v3

## Overview
This specification addresses the runtime and product-surface gaps identified in `audit3.md`. It covers missing backend routes, API contract misalignment, incomplete Watch Job capabilities, missing live integrations in the dashboard, and simulated implementations in the Waterfall Engine.

## 1. Missing Backend Routes
The frontend UI depends on several v2 CrawlX endpoints that currently do not exist.

**New Files & Routes (`apps/api/src/routes/crawlx/v2/`)**:
- `failures.ts`:
  - `GET /`: `PaginatedResponse<Failure>`
  - `GET /groups`: `FailureGroup[]`
  - `GET /engines`: `EngineSuccessRate[]`
- `extractions.ts`:
  - `GET /`: `PaginatedResponse<Extraction>`
- `activity.ts`:
  - `GET /`: `PaginatedResponse<ActivityLogEntry>`
- `usage.ts`:
  - `GET /`: `UsageEntry[]`
- `receipts.ts`:
  - `GET /`: `PaginatedResponse<BrowserReceipt>`

**Updated Files**:
- `jobs.ts`: Add `POST /:id/replay` returning the duplicated/restarted `Job`.
- `index.ts`: Import and mount the new routers (`/failures`, `/extractions`, `/activity`, `/usage`, `/receipts`).

## 2. API Contract Alignment
- **Pagination**: The `JobsPage` and `PagesPage` expect `PaginatedResponse<T>`.
  - Modify `jobs.ts` GET `/` to return `{ data: jobs, total, page, per_page, total_pages }`.
  - Modify `pages.ts` GET `/` similarly.
- **Domain Policy**: The frontend uses `POST /v2/crawlx/domains` for creation and `PATCH /v2/crawlx/domains/:domain` for updates.
  - Modify `domains.ts` to implement `POST /` (insert) and `PATCH /:domain` (partial update), replacing `PUT /:domain`.

## 3. Watch Job Hardening (Track 9)
- **DB Schema (`packages/db/src/schema/watch-jobs.ts`)**: Add `schema` (`jsonb`) and `webhook` (`text`) columns to `watchJobs`.
- **API (`watch.ts`)**: Read `schema` and `webhook` from the request body and persist them in the DB insert.

## 4. Dashboard Completion (Track 7)
Remove hardcoded `MOCK_*` constants and replace with `useState` / `useEffect` hooks utilizing the `api` methods from `apps/web/src/api/client.ts`.
- `JobDetailPage.tsx`: `api.fetchJob(jobId)`
- `PagesPage.tsx`: `api.fetchPages()`
- `FailuresPage.tsx`: `api.fetchFailures()`, `api.fetchFailureGroups()`, `api.fetchEngineSuccessRates()`
- `ReceiptsPage.tsx`: `api.fetchReceipts()`

## 5. Waterfall Engine Implementation (Track 3)
Remove naive simulations in `packages/waterfall-engine/src/engines/`:
- `crawlx-recipe.ts`: Implement actual dispatch to recipe execution layer.
- `crawlx-branded-browser.ts`: Implement realistic playwright request handling.
- `manual-review.ts`: Implement database insert to a review queue (or update status in DB) instead of returning an `ok` simulated success.
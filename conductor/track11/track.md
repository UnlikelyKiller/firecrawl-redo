# Track 11: API Remediation (Remediation v3 Phase 1 & 2)

## Objective
Align the API with the frontend contract and implement missing visibility routes to replace mocked data.

## Deliverables
- [x] **Task 11.1: DB Schema Update**
    - Update `packages/db/src/schema/watch-jobs.ts` to include `schema` (jsonb) and `webhook` (text).
- [x] **Task 11.2: Domain Policy Routes**
    - Refactor `apps/api/src/routes/crawlx/v2/domains.ts` to expose `POST /` and `PATCH /:domain`.
- [x] **Task 11.3: Pagination Standardization**
    - Update `jobs.ts` and `pages.ts` to return `{ data, total, page, per_page, total_pages }`.
- [x] **Task 11.4: Implement Visibility Routes**
    - `failures.ts`: `GET /`, `GET /groups`, `GET /engines`.
    - `extractions.ts`: Paginated `GET /`.
    - `activity.ts`: Unified activity logs `GET /`.
    - `usage.ts`: Billing/usage metrics `GET /`.
    - `receipts.ts`: HAR and video artifact metadata `GET /`.
- [x] **Task 11.5: Job Replay**
    - Implement `POST /v2/jobs/:id/replay`.

## Verification
- [x] `pnpm --filter "@crawlx/db" run test`
- [x] `pnpm --filter "api" run test` (Focus on new routes)
- [x] Manual verification via `curl` or `requests.http`

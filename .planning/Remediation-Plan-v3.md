## Plan: Remediation v3
### Phase 1: DB Schema and Contract Alignment
- [ ] Task 1.1: Update `packages/db/src/schema/watch-jobs.ts` to include `schema` (jsonb) and `webhook` (text).
- [ ] Task 1.2: Refactor `apps/api/src/routes/crawlx/v2/domains.ts` to expose `POST /` (create policy) and `PATCH /:domain` (update policy) to match the frontend `api.ts` contract.
- [ ] Task 1.3: Standardize pagination responses in `apps/api/src/routes/crawlx/v2/jobs.ts` and `apps/api/src/routes/crawlx/v2/pages.ts` by returning `{ data: [...], total, page, per_page, total_pages }` instead of `{ jobs: [...] }` / `{ pages: [...] }`.

### Phase 2: Implement Missing Backend Routes
- [ ] Task 2.1: Create `apps/api/src/routes/crawlx/v2/failures.ts` to handle `GET /`, `GET /groups`, and `GET /engines` returning structured failure data.
- [ ] Task 2.2: Create `apps/api/src/routes/crawlx/v2/extractions.ts` to handle `GET /` returning paginated extractions.
- [ ] Task 2.3: Create `apps/api/src/routes/crawlx/v2/activity.ts` to handle `GET /` returning unified activity logs.
- [ ] Task 2.4: Create `apps/api/src/routes/crawlx/v2/usage.ts` to handle `GET /` returning billing/usage metrics.
- [ ] Task 2.5: Create `apps/api/src/routes/crawlx/v2/receipts.ts` to handle `GET /` returning HAR and video artifact metadata.
- [ ] Task 2.6: Update `apps/api/src/routes/crawlx/v2/jobs.ts` to include `POST /:id/replay` which triggers a durable job replay.
- [ ] Task 2.7: Update `apps/api/src/routes/crawlx/v2/watch.ts` to persist the `schema` and `webhook` fields from the request body into the DB.
- [ ] Task 2.8: Update `apps/api/src/routes/crawlx/v2/index.ts` to import and mount the new routes (`failures`, `extractions`, `activity`, `usage`, `receipts`).

### Phase 3: Dashboard Live Data Integration (Track 7)
- [ ] Task 3.1: Refactor `apps/web/src/pages/JobDetailPage.tsx` to remove `MOCK_DETAIL` and fetch data using `api.fetchJob(jobId)`.
- [ ] Task 3.2: Refactor `apps/web/src/pages/PagesPage.tsx` to remove `MOCK_PAGES` and fetch data using `api.fetchPages()`.
- [ ] Task 3.3: Refactor `apps/web/src/pages/FailuresPage.tsx` to remove `MOCK_GROUPS`/`MOCK_ENGINE_RATES` and fetch data using `api.fetchFailureGroups()` and `api.fetchEngineSuccessRates()`.
- [ ] Task 3.4: Refactor `apps/web/src/pages/ReceiptsPage.tsx` to remove `MOCK_RECEIPTS` and fetch data using `api.fetchReceipts()`.

### Phase 4: Waterfall Engine Hardening (Track 3)
- [ ] Task 4.1: Update `packages/waterfall-engine/src/engines/crawlx-recipe.ts` to actually execute the recipe runner or properly dispatch to the recipe queue rather than returning a mocked success.
- [ ] Task 4.2: Update `packages/waterfall-engine/src/engines/crawlx-branded-browser.ts` to instantiate a playwright session with the branded browser extension.
- [ ] Task 4.3: Update `packages/waterfall-engine/src/engines/manual-review.ts` to insert a pending record into the database (e.g. `manual_review_queue` or update page status) instead of just returning a simulated in-process transition.
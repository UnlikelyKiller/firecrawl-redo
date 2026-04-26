# Track 12: Dashboard Live Integration (Remediation v3 Phase 3)

## Objective
Transition the React dashboard from static mocks to real backend data.

## Deliverables
- [x] **Task 12.1: Job Detail Integration**
    - Refactor `JobDetailPage.tsx` to use `api.fetchJob(jobId)`.
- [x] **Task 12.2: Pages Integration**
    - Refactor `PagesPage.tsx` to use `api.fetchPages()`.
- [x] **Task 12.3: Failures Integration**
    - Refactor `FailuresPage.tsx` to use `api.fetchFailureGroups()` and `api.fetchEngineSuccessRates()`.
- [x] **Task 12.4: Receipts Integration**
    - Refactor `ReceiptsPage.tsx` to use `api.fetchReceipts()`.
- [x] **Task 12.5: Usage & Activity Integration**
    - Refactor `UsagePage.tsx` and `ActivityPage.tsx` to use live endpoints.
- [x] **Task 12.6: Extractions Integration** (Added)
    - Refactor `ExtractionsPage.tsx` to use `api.fetchExtractions()`.

## Verification
- [x] `pnpm --filter "@crawlx/web" run build`
- [x] E2E test: Dashboard displays real job data from DB.

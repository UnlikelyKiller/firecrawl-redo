# Track 14: Integration & Hardening

## Objective
Address critical integration gaps in the worker, orchestrator, and dashboard to ensure end-to-end functionality for Tandem, Manual Review, and live data.

## Deliverables
- [x] **Task 14.1: Orchestrator Short-circuit**
    - Update `packages/waterfall-engine/src/orchestrator.ts` to halt the waterfall if an engine returns `PENDING_REVIEW`.
- [x] **Task 14.2: Worker Engine Wiring**
    - Update `packages/jobs/src/worker.ts` to instantiate `ManualReviewEngine` in `buildEngines`.
    - Provide a concrete `ManualReviewLogger` implementation that writes to the `manual_reviews` table.
- [x] **Task 14.3: Metadata & Receipt Persistence**
    - Update `ScrapeWorker` in `packages/jobs/src/worker.ts` to extract `metadata` from engine results.
    - Store the metadata as a content-addressed artifact and persist its hash to the database via `JobPersistenceService.savePage`.
- [x] **Task 14.4: Frontend Polishing & Pagination**
    - **Pagination:** Implement "Previous/Next" controls and use `total_pages` metadata in `JobsPage.tsx`, `PagesPage.tsx`, and `ExtractionsPage.tsx`.
    - **Activity Filtering:** Transition `ActivityPage.tsx` from client-side to server-side filtering using the `correlation_id` API parameter.
    - **UI Consistency:** Standardize loading classes, date formatting (via a shared utility), and add "No data found" empty states.
- [x] **Task 14.5: Tandem allowStealthCompromise wiring in ScrapeWorker**
    - Ensure that when the worker uses Tandem, it passes the correct options if needed.

## Verification
- [x] `pnpm --filter "@crawlx/waterfall-engine" run test`
- [x] `pnpm --filter "@crawlx/jobs" run test`
- [x] E2E: Manual Review record appears in DB when all engines fail.
- [x] E2E: Browser receipts (HAR/Video) hashes appear in the dashboard.

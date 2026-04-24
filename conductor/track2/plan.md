# Plan: Track 2 - Durable Job Model + Artifact Persistence + Replay

### Phase 1: Database Persistence Service
- [x] Task 1.1: Update `packages/db` schema with `type`, `url`, `payload`, and `error` fields for `crawl_jobs` and `engine_attempts`.
- [x] Task 1.2: Implement `JobPersistenceService` in `packages/jobs/src/persistence.ts` to manage job lifecycle and artifact pointers.
- [x] Task 1.3: Generate and verify Drizzle migrations for the schema updates.

### Phase 2: Worker Integration
- [x] Task 2.1: Update `ScrapeWorker` to use `JobPersistenceService` for recording engine attempts and updating job statuses.
- [x] Task 2.2: Ensure all page artifact pointers (markdown, HTML) are persisted correctly via `savePage`.

### Phase 3: Replay Mechanism
- [x] Task 3.1: Implement `JobReplayService` in `packages/jobs/src/replay.ts` to re-enqueue jobs using their original data.
- [x] Task 3.2: Add `/v2/crawlx/replay/:jobId` endpoint to the API router.

### Phase 4: Artifact Retrieval API
- [x] Task 4.1: Implement `/v2/crawlx/artifacts/:hash` endpoint to serve content-addressed files.
- [x] Task 4.2: Add error classification logic to distinguish between failure types (TIMEOUT, BLOCKED, etc.).

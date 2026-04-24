# Plan: Track 1 - Firecrawl v2.8 Compatibility + Durable Jobs

### Phase 1: Setup Workspace & Core Schemas
- [ ] Task 1.1: Initialize `packages/firecrawl-compat/` workspace and install Zod 4.
- [ ] Task 1.2: Implement and unit test v2.8 request/response schemas for `/v2/scrape` and `/v2/crawl` (supporting `sitemapOnly`, `ignoreCache`, `customHeaders`, `formats`, `timeoutMs`).
- [ ] Task 1.3: Implement and unit test v2.8 schemas for `/v2/map`, `/v2/search`, and `/v2/batch/scrape`.

### Phase 2: Content-Addressed Storage
- [ ] Task 2.1: Initialize `packages/artifact-store/` workspace and install necessary hashing/file-system utilities.
- [ ] Task 2.2: Implement `content-addressed.ts` using TDD to compute SHA256, extract `{first2}/{next2}`, and write files correctly.
- [ ] Task 2.3: Implement artifact retrieval and deletion capabilities, ensuring db-hash pointers structure readiness.

### Phase 3: Firecrawl Upstream Client
- [ ] Task 3.1: Initialize `packages/firecrawl-client/` workspace and install `opossum` and `neverthrow`.
- [ ] Task 3.2: Implement HTTP client wrappers for Firecrawl OSS endpoints using TDD.
- [ ] Task 3.3: Wrap client calls in `opossum` circuit breaker and return `ResultAsync` from `neverthrow`.

### Phase 4: BullMQ Durable Jobs Setup
- [ ] Task 4.1: Install BullMQ and Redis dependencies in the API or dedicated worker package.
- [ ] Task 4.2: Define job types and transition states (QUEUED, RUNNING, COMPLETED, FAILED, COMPLETED_WITH_WARNINGS, CANCELLED).
- [ ] Task 4.3: Implement the BullMQ worker that processes jobs using `packages/firecrawl-client/` and stores results using `packages/artifact-store/`.

### Phase 5: Fastify API Endpoints
- [ ] Task 5.1: Scaffold `apps/api/src/routes/v2/` endpoints with Fastify and integrate Zod validation via `packages/firecrawl-compat/`.
- [ ] Task 5.2: Implement route handlers to dispatch jobs to BullMQ and return immediate response or job ID.
- [ ] Task 5.3: Implement status/polling endpoints for `/v2/crawl/{id}` and `/v2/batch/scrape/{id}`.
- [ ] Task 5.4: Implement `501 Not Implemented` response for `/v2/agent` and `/v2/interact`.
- [ ] Task 5.5: Mount BullMQ Board UI at `/admin/queues` in Fastify.

### Phase 6: CLI Tooling
- [ ] Task 6.1: Initialize `apps/cli/` workspace and install `Commander.js`.
- [ ] Task 6.2: Implement `scrape.ts` command (`crawlx scrape <url> [--format ...]`).
- [ ] Task 6.3: Integrate CLI with the Fastify API and handle displaying output results to stdout.

### Phase 7: End-to-End Testing & Review
- [ ] Task 7.1: Write integration tests covering the full flow from `/v2/scrape` to BullMQ to Firecrawl client to Artifact Store.
- [ ] Task 7.2: Verify circuit breaker fallback/failure scenarios.
- [ ] Task 7.3: Review and finalize documentation for Track 1 completion.

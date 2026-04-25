# Plan: Track 1 - Firecrawl v2 Compatibility + Durable Jobs Refresh

### Phase 1: API Contract Review
- [ ] Task 1.1: Reconcile `packages/firecrawl-compat` with the updated implementation plan and current API surface.
- [ ] Task 1.2: Confirm which endpoints remain passthrough-oriented versus fully local orchestration surfaces.
- [ ] Task 1.3: Define response-shape compatibility expectations for jobs, artifacts, and status polling.

### Phase 2: Durable Job Planning
- [ ] Task 2.1: Review BullMQ and DB responsibilities so job durability stays clear as external browser backends are added later.
- [ ] Task 2.2: Define artifact-pointer expectations for markdown, HTML, screenshot, video, ARIA, HAR, and metadata hashes.
- [ ] Task 2.3: Define typed error-envelope behavior for not-yet-implemented or policy-denied paths.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define contract tests for `/v2/*` compatibility.
- [ ] Task 3.2: Define integration tests from request -> queue -> persistence -> status endpoint.
- [ ] Task 3.3: Define CLI/API parity checks for basic scrape flows.

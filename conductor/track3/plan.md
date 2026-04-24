## Plan: Track 3 - Waterfall Engine + Playwright Worker + Video Receipts

### Phase 1: Waterfall Engine Core (`packages/waterfall-engine`)
- [ ] Task 1.1: Initialize `packages/waterfall-engine` package with `package.json`, TS config, and dependencies (neverthrow, zod@4).
- [ ] Task 1.2: Define the `CrawlEngine` interface and Zod 4 schemas for inputs/outputs in `src/engine.ts`. Include strict error typing.
- [ ] Task 1.3: Implement `WaterfallOrchestrator` in `src/orchestrator.ts` with TDD. Ensure fallback logic works robustly using neverthrow's `ResultAsync` and proper error chaining.
- [ ] Task 1.4: Implement `FirecrawlStaticEngine` using simple HTTP fetching to serve as the baseline, low-cost engine.
- [ ] Task 1.5: Implement `FirecrawlJsEngine` by wrapping the existing `firecrawl-client` (or equivalent JS rendering mechanism) as the intermediate fallback.

### Phase 2: Playwright Worker (`apps/browser-worker`)
- [ ] Task 2.1: Initialize `apps/browser-worker` service with Playwright pinned exactly to version `1.59`, neverthrow, zod@4, and a basic HTTP/RPC server (e.g., Fastify/Express).
- [ ] Task 2.2: Setup Playwright browser lifecycle management. Decide on and implement browser context pooling or per-request isolated contexts.
- [ ] Task 2.3: Implement the core page navigation and HTML extraction logic, ensuring strict timeouts and resource limits.
- [ ] Task 2.4: Implement standard artifact capture: extracting screenshots (`.png`) and network traces (`.har`).
- [ ] Task 2.5: Implement advanced artifact capture: recording video receipts (`.webm`) of the session and capturing ARIA snapshots.
- [ ] Task 2.6: Integrate the `artifact-store` (Content-Addressing) to upload generated artifacts (WebM, PNG, HAR, ARIA) and return their content hashes (e.g., CIDs) in the response.

### Phase 3: Integration & End-to-End Orchestration
- [ ] Task 3.1: Implement `CrawlxPlaywrightEngine` in `packages/waterfall-engine`. This engine acts as the client that sends extraction requests to the `apps/browser-worker` API.
- [ ] Task 3.2: Update `packages/jobs` to import and configure the `WaterfallOrchestrator`, setting the engine priority list (Static -> JS -> Playwright).
- [ ] Task 3.3: Refactor the `ScrapeWorker` (or equivalent worker process) in `packages/jobs` to use the orchestrator pipeline for processing incoming scrape requests.
- [ ] Task 3.4: Write comprehensive End-to-End tests verifying that a job will correctly fallback to the Playwright engine when static/JS engines fail, and successfully return the artifact content hashes.
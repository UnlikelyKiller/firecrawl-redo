## Plan: Remediation v2
### Phase 1: Fix API Build & Types
- [ ] Task 1.1: Modify `apps/api/src/lib/db.ts` to use `postgres-js` and `drizzle-orm/postgres-js` instead of `node-postgres`.
- [ ] Task 1.2: Update `ExtractionPipeline` instantiations in `apps/api/src/routes/crawlx/v2/extract.ts` and `agent.ts` to pass `{ logger }` as an option rather than a direct parameter.

### Phase 2: Align DB Schemas
- [ ] Task 2.1: Update `packages/db/src/schema/watch-jobs.ts` to include `checkInterval` (text), `active` (boolean), `lastCheckAt` (timestamp), and `nextCheckAt` (timestamp).
- [ ] Task 2.2: Update `packages/db/src/schema/webhook-subscriptions.ts` to include `createdAt` (timestamp), `eventTypes` (text array), and `active` (boolean).
- [ ] Task 2.3: Update `packages/db/src/schema/llm_calls.ts` to include `tokensIn` (integer), `tokensOut` (integer), `latencyMs` (integer), `costEstimateCents` (integer), and `correlationId` (uuid). Adjust `apps/api/src/routes/crawlx/v2/extract.ts` if needed to match.

### Phase 3: Remediate Agent & Extract Logic
- [ ] Task 3.1: Create and export a dedicated `AgentRequestSchema` in the appropriate shared library or local file.
- [ ] Task 3.2: Update `apps/api/src/routes/crawlx/v2/agent.ts` to use `AgentRequestSchema` and implement a true Search -> Scrape -> Extract loop instead of a hardcoded scrape.
- [ ] Task 3.3: Update `apps/api/src/routes/crawlx/v2/extract.ts` to correctly pipe the user-provided schema into the `pipeline.extract` call instead of using `z.any()`.

### Phase 4: Implement Waterfall Engine Logic
- [ ] Task 4.1: Update `CrawlxBrandedBrowserEngine` in `packages/waterfall-engine` to perform realistic tasks (e.g. communicate with a microservice or run an actual Playwright script).
- [ ] Task 4.2: Update `ManualReviewEngine` to handle asynchronous queuing or simulate a paused job state for manual review.
- [ ] Task 4.3: Update `FirecrawlCloudEngine` to construct and execute an external HTTP request mimicking a call to the external Firecrawl API.

### Phase 5: Wire Web Dashboard to Real APIs
- [ ] Task 5.1: Refactor `apps/web/src/pages/JobsPage.tsx` to execute an API call to `/api/crawlx/v2/jobs` instead of using mocked arrays.
- [ ] Task 5.2: Refactor `apps/web/src/pages/UsagePage.tsx` to execute an API call to `/api/crawlx/v2/stats`.
- [ ] Task 5.3: Refactor `apps/web/src/pages/ActivityPage.tsx` to execute an API call to `/api/crawlx/v2/pages` (or appropriate activity route).
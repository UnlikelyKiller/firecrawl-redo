# Remediation Spec v2

## 1. API Build Breakage
The current `apps/api/src/lib/db.ts` uses `drizzle-orm/node-postgres` and `pg`, which mismatches the core workspace `@crawlx/db` setup and fails resolution during the `apps/api` build process. 
- **Fix:** Update `apps/api/src/lib/db.ts` to use `postgres-js` and `drizzle-orm/postgres-js`. Replace the `Pool` initialization with `postgres(process.env.DATABASE_URL)`. 
- **Fix:** Fix type mismatches in `apps/api/src/routes/crawlx/v2/extract.ts` and `agent.ts` regarding `ExtractionPipeline`. Update instantiation to pass `logger` inside an options object instead of as a second direct parameter (e.g., `new ExtractionPipeline(modelRouter, { logger })`).

## 2. Schema/Route Alignment
Several routes insert data into fields that are missing or incorrectly named in the Drizzle schemas under `packages/db/src/schema/`.
- **`watch-jobs.ts`**: Add `checkInterval: text("check_interval")`, `active: boolean("active")`, `lastCheckAt: timestamp("last_check_at")`, `nextCheckAt: timestamp("next_check_at")`.
- **`webhook-subscriptions.ts`**: Add `createdAt: timestamp("created_at").defaultNow().notNull()`, `eventTypes: text("event_types").array()`, `active: boolean("active")`.
- **`llm_calls.ts`**: Ensure the following fields are present to match what is written by `extract.ts`: `tokensIn: integer("tokens_in")`, `tokensOut: integer("tokens_out")`, `latencyMs: integer("latency_ms")`, `costEstimateCents: integer("cost_estimate_cents")`, `correlationId: uuid("correlation_id")`. Ensure these properly replace or alias `promptTokens` and `completionTokens`.

## 3. Agent & Extract Functional Gaps
- **`agent.ts`**:
  - Implement a real workflow loop: Search -> Scrape -> Extract. Provide a functional search mechanism or integrate with a Search Provider instance.
  - Define and use a dedicated `AgentRequestSchema` rather than incorrectly validating against `ExtractRequestSchema`.
  - Pass the correctly validated, user-provided Zod schema into `pipeline.extract(..., schema)` instead of blindly passing `req.body.schema || {}`.
- **`extract.ts`**:
  - Ensure the user-provided schema is correctly piped into `ExtractionPipeline.extract`. Currently, it passes `z.any()` which completely bypasses the extracted structure the user requested.

## 4. Waterfall Engine Implementation
Replace synthetic success bodies with actual implementation logic or realistic stubs that perform real-world side effects.
- **`CrawlxBrandedBrowserEngine`**: Simulate a branded browser task via delays and DOM extraction or route correctly to a Playwright microservice.
- **`ManualReviewEngine`**: Return an appropriate intermediate state (e.g., job pending manual review) or simulate a timeout/delay process.
- **`FirecrawlCloudEngine`**: Make a genuine external HTTP request to `api.firecrawl.com` or properly mock an external HTTP boundary with simulated failure and retry scenarios.

## 5. Dashboard Mock Data
The Web Dashboard is rendering hardcoded mocks.
- **`apps/web/src/pages/`**:
  - `JobsPage.tsx`: Replace `MOCK_JOBS` by fetching from `GET /api/crawlx/v2/jobs`.
  - `UsagePage.tsx`: Replace `MOCK_USAGE` by fetching from `GET /api/crawlx/v2/stats`.
  - `ActivityPage.tsx`: Replace `MOCK_ACTIVITY` by fetching from `GET /api/crawlx/v2/pages` (or the equivalent activity endpoint).
  - Add standard loading and error states for these fetches.
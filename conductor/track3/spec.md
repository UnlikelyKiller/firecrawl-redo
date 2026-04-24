# Specification: Track 3 - Waterfall Engine + Playwright Worker + Video Receipts

## 1. Overview
The goal of this track is to implement a resilient multi-engine fallback mechanism (`WaterfallOrchestrator`) and a dedicated Playwright-based browser worker capable of advanced extraction tasks. The new system will try faster/cheaper extraction methods first, and progressively fall back to heavier methods (like a full headless browser) if the initial methods fail. The Playwright worker will also capture rich debugging and proof-of-execution artifacts, including video receipts, ARIA snapshots, screenshots, and HAR files.

## 2. Architecture & Deliverables

### 2.1 `packages/waterfall-engine`
A new package responsible for orchestrating multiple scraping engines.
- **`src/engine.ts`**:
  - Defines the core `CrawlEngine` interface.
  - Uses `neverthrow` to return `ResultAsync<EngineResponse, EngineError>` to enforce robust error handling.
  - Utilizes `Zod` (v4) for strict input and output validation schemas.
- **`src/orchestrator.ts`**:
  - Contains the `WaterfallOrchestrator` class.
  - Takes an ordered array of `CrawlEngine` instances.
  - Iterates through the engines sequentially; if an engine fails (e.g., HTTP 403, CAPTCHA detected, timeout), it gracefully falls back to the next engine in the list.
- **Engine Implementations**:
  - `FirecrawlStaticEngine`: Basic HTTP static fetching (fastest, lowest cost).
  - `FirecrawlJsEngine`: Wraps the `firecrawl-client` for basic JavaScript rendering.
  - `CrawlxPlaywrightEngine`: Interacts with the local `browser-worker` to perform advanced JS rendering, stealth navigation, and artifact generation.

### 2.2 `apps/browser-worker`
A new standalone microservice/app dedicated to running Playwright instances.
- **Core Technology**: Playwright version `1.59`.
- **Capabilities**:
  - Provides an RPC or HTTP API to accept scrape requests from `CrawlxPlaywrightEngine`.
  - **Video Receipts**: Records the browser session into a `.webm` file for debugging and proof-of-execution.
  - **ARIA Snapshots**: Captures the accessibility tree for LLM-friendly structural parsing.
  - **Standard Artifacts**: Takes `.png` screenshots and records `.har` network traces.
- **Storage**: Uses Content-Addressing (via the `artifact-store` package) to securely store generated artifacts and return their deterministic hashes (e.g., CIDs).

### 2.3 `packages/jobs` Integration
- Updates the existing job processing logic (e.g., `ScrapeWorker`) to utilize the new `WaterfallOrchestrator`.
- Replaces direct calls to existing scrapers with a configured orchestrator pipeline: `Static Engine -> JS Engine -> Playwright Engine`.

## 3. Technical Guidelines
1. **Test-Driven Development (TDD)**: All engines and orchestrator logic must have unit tests written prior to or alongside implementation.
2. **Neverthrow**: No `try/catch` for expected business logic errors; everything must return a `Result` or `ResultAsync`.
3. **Zod 4**: Ensure all schemas use the latest Zod 4 syntax and capabilities.
4. **Playwright 1.59**: Strict version pinning for the browser worker.
5. **Content-Addressing**: All captured media and traces (Video, HAR, PNG) must be saved using content-addressable storage mechanisms.

# Specification: Track 1 - Firecrawl v2.8 Compatibility + Durable Jobs

## 1. Overview
The goal of this track is to implement Firecrawl v2.8 compatible endpoints (`/v2/scrape`, `/v2/crawl`, `/v2/map`, `/v2/search`, `/v2/batch/scrape`) that route requests to an underlying Firecrawl OSS instance using a durable job queue system (BullMQ). We will implement strict request/response validation using Zod 4, a resilient client using `opossum` for circuit breaking, content-addressed storage for artifacts, and a CLI tool for local interactions.

## 2. Architecture & Components

### 2.1. `packages/firecrawl-compat/`
- **Purpose**: Centralize Zod 4 schemas that perfectly match Firecrawl v2.8 API contracts.
- **Schemas to Implement**:
  - `ScrapeRequestSchema` / `ScrapeResponseSchema`
  - `CrawlRequestSchema` / `CrawlResponseSchema` / `CrawlStatusResponseSchema`
  - `MapRequestSchema` / `MapResponseSchema`
  - `SearchRequestSchema` / `SearchResponseSchema`
  - `BatchScrapeRequestSchema` / `BatchScrapeStatusResponseSchema`
- **Supported v2.8 Options**:
  - `sitemapOnly` (boolean)
  - `ignoreCache` (boolean)
  - `customHeaders` (Record<string, string>)
  - `formats` (array of 'markdown', 'html', 'json', 'screenshot')
  - `timeoutMs` (number)

### 2.2. `packages/firecrawl-client/`
- **Purpose**: Typed wrapper for making outbound calls to the upstream Firecrawl OSS service.
- **Resilience**: Integrated with `opossum` for circuit-breaking (e.g., if Firecrawl OSS is down, fail fast).
- **Return Types**: Utilize `neverthrow` (`ResultAsync<T, E>`) for functional error handling.

### 2.3. `packages/artifact-store/src/content-addressed.ts`
- **Purpose**: Store scraping/crawling artifacts persistently and deduplicated.
- **Path Structure**: `data/artifacts/sha256/{first2}/{next2}/{hash}.{ext}`
  - Example: `data/artifacts/sha256/a1/b2/a1b2c3d4e5f6.html`
- **Database integration**: The application database will only store pointers (hashes) to these artifacts.

### 2.4. `apps/api/` (Fastify Service)
- **v2 Routes (`apps/api/src/routes/v2/`)**:
  - Expose the endpoints defined in `packages/firecrawl-compat/`.
  - `/v2/agent` and `/v2/interact` will immediately return `501 Not Implemented`.
  - All valid requests are transformed into jobs and pushed to BullMQ.
- **Admin Board**:
  - Expose BullMQ Board at `/admin/queues` for monitoring and debugging queue health.

### 2.5. Durable Job Lifecycle (BullMQ)
- **Job States**:
  - `QUEUED`: Request accepted, waiting for worker.
  - `RUNNING`: Worker picked up the job, executing via `firecrawl-client`.
  - `COMPLETED`: Successfully finished. Artifacts saved to store.
  - `FAILED`: Unrecoverable error (e.g., circuit breaker open, target down).
  - `COMPLETED_WITH_WARNINGS`: Partial success (e.g., some URLs in a batch failed).
  - `CANCELLED`: User requested abort.

### 2.6. `apps/cli/src/commands/scrape.ts`
- **Purpose**: Command Line Interface for direct scraping interactions.
- **Framework**: `Commander.js`
- **Usage**: `crawlx scrape <url> [--format markdown|html|json|screenshot]`
- **Integration**: Communicates with the local `apps/api/` to trigger scraping and output the result.

## 3. Technology Stack & Guidelines
- **Validation**: Zod 4
- **Error Handling**: `neverthrow`
- **Task Queue**: BullMQ
- **Circuit Breaker**: `opossum`
- **CLI**: `Commander.js`
- **Methodology**: Test-Driven Development (TDD) required for all logic, especially routing, schema validation, and storage mechanisms.

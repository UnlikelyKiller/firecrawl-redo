# Track 2: Durable Job Model + Artifact Persistence + Replay Specification

## Overview
This specification details the implementation for robust job persistence, artifact storage, and job retry/replay mechanisms within the Firecrawl Redo architecture. It bridges BullMQ's ephemeral job queues with PostgreSQL's durable storage via Drizzle ORM, ensuring an accurate historical record of all crawl/scrape attempts and their respective outcomes.

## Deliverables & Technical Architecture

### 1. Job Persistence Service (`packages/jobs/src/persistence.ts`)
A Drizzle-based service to handle CRUD operations for jobs, attempts, and snapshots.
- **Dependencies**: `drizzle-orm`, `neverthrow`, `zod`.
- **Core Methods**:
  - `createJob(params)`: Initializes a `crawl_jobs` record.
  - `updateJobStatus(jobId, status)`: Transitions job status.
  - `recordEngineAttempt(params)`: Logs an entry in `engine_attempts`, mapping to specific failure classifications if applicable.
  - `recordSnapshot(params)`: Logs a `page_snapshots` entry with the `contentHash` representing the pointer to artifact store.

### 2. BullMQ Event Listeners
Hooks to listen to BullMQ queue events and synchronize state into Postgres.
- **Events**: `active`, `completed`, `failed`.
- **Action**: Dispatches calls to `updateJobStatus` and logs telemetry via the persistence service. Maintains a source of truth in PostgreSQL even if jobs drop from BullMQ's Redis store.

### 3. Replay Mechanism (`packages/jobs/src/replay.ts`)
Functionality to revive failed jobs.
- **Behavior**: Re-enqueues a job in BullMQ using the original job payload/options retrieved from PostgreSQL or a failed queue.
- **Data Integrity**: Associates the newly queued job with the same Postgres `job_id` but creates new `engine_attempts` records to track the retry.

### 4. Artifact Retrieval API (`apps/api/src/routes/v2/artifacts.ts`)
Endpoint to access content-addressed artifacts (HTML, markdown, screenshots).
- **Route**: `GET /v2/crawlx/artifacts/:hash`
- **Controller**: Parses the `hash`, retrieves the binary or text payload from the `artifact-store` (backed by content hashing), and streams it back to the client with appropriate `Content-Type` headers.

### 5. Error Classification
Standardize failure reasons within `engine_attempts.status`.
- **Enums/Types**:
  - `TIMEOUT`: Engine took too long.
  - `BLOCKED`: WAF, Captcha, or 403 Forbidden.
  - `SSRF_VIOLATION`: Security block (e.g., local IPs).
  - `UPSTREAM_DOWN`: Target server 5xx errors.
  - `UNKNOWN_ERROR`: Fallback for unclassified failures.

## Development Guidelines
- **TDD**: Write tests before implementing persistence logic or API endpoints.
- **Functional Error Handling**: Use `neverthrow`'s `Result` / `ResultAsync` for all database and Queue operations to avoid standard try-catch propagation.
- **Validation**: Use Zod 4 for input validation on replay payloads and API endpoints.
- **Content Addressing**: Ensure snapshots and artifacts are identified strictly by their SHA-256 hash or similar content-addressable identifiers instead of primary keys.
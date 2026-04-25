# Plan: Track 9 - Change Tracking + Scheduled Recrawls + Watch Jobs

### Phase 1: Snapshot and Diff Planning
- [ ] Task 1.1: Define snapshot persistence and content-hash rules.
- [ ] Task 1.2: Define markdown, metadata, and structured extraction diff behavior.
- [ ] Task 1.3: Define watch-job scheduling and retention requirements.

### Phase 2: Watch Flow Planning
- [ ] Task 2.1: Define recrawl triggers, backoff rules, and notification behavior.
- [ ] Task 2.2: Define how policy and rate limits constrain watch jobs.
- [ ] Task 2.3: Define how watch jobs interact with receipts and extraction outputs.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define hash-change and diff-output tests.
- [ ] Task 3.2: Define scheduler tests for watch-job timing and retries.
- [ ] Task 3.3: Define end-to-end tests for recrawl -> diff -> webhook/dashboard visibility.

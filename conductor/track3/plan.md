# Plan: Track 3 - Waterfall Engine + Browser Worker + Receipts Refresh

### Phase 1: Waterfall Ladder Review
- [ ] Task 1.1: Reconcile the updated engine ladder with the current implementation plan.
- [ ] Task 1.2: Document engine eligibility rules, failure transitions, and manual-review escalation.
- [ ] Task 1.3: Define the receipt expectations per engine and identify where capability gating is required.

### Phase 2: Browser Worker Planning
- [ ] Task 2.1: Define browser-worker responsibilities for screenshots, video, ARIA snapshots, HAR, rendered HTML, and console logs.
- [ ] Task 2.2: Define sandbox and timeout requirements for recipe execution.
- [ ] Task 2.3: Define how the browser worker publishes artifacts into the content-addressed store.

### Phase 3: Orchestrator and Testing Plan
- [ ] Task 3.1: Define `WaterfallOrchestrator` contract tests for fallback and failure classification.
- [ ] Task 3.2: Define end-to-end tests for Playwright fallback and manual-review routing.
- [ ] Task 3.3: Define capability-matrix testing for non-native engines that may join later.

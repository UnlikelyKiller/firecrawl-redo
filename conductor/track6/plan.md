# Plan: Track 6 - Agent Lite + Search + Webhooks + Handoff Flows

### Phase 1: Agent Loop Planning
- [ ] Task 1.1: Define the bounded agent loop from planning to search to scrape to extract to response.
- [ ] Task 1.2: Define budget limits for search, browser actions, LLM calls, and runtime.
- [ ] Task 1.3: Define source-citation and warning behavior.

### Phase 2: Webhook and Handoff Planning
- [ ] Task 2.1: Define webhook event coverage, signatures, retries, and redaction modes.
- [ ] Task 2.2: Define operator handoff and resume semantics when a human session is required.
- [ ] Task 2.3: Define how agent steps interact with named profiles and external sessions without violating lease ownership.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define agent flow integration tests.
- [ ] Task 3.2: Define webhook delivery tests.
- [ ] Task 3.3: Define human-handoff tests for pause/resume and audit events.

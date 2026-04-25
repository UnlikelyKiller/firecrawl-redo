# Plan: Track 2 - Job Durability + Replay + Artifacts Refresh

### Phase 1: Persistence Review
- [ ] Task 1.1: Review the job persistence model against the updated artifact and external-backend requirements.
- [ ] Task 1.2: Define how engine attempts, replay lineage, and artifact hashes are represented consistently.
- [ ] Task 1.3: Define activity-log and usage-meter interactions with persisted job state.

### Phase 2: Replay and Retrieval Planning
- [ ] Task 2.1: Define replay semantics for failed, partial, and policy-blocked jobs.
- [ ] Task 2.2: Define artifact retrieval planning for all receipt types, including ARIA and future external-browser artifacts.
- [ ] Task 2.3: Define how replay should behave when the original job used a named profile or external backend.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define persistence integration tests and replay tests.
- [ ] Task 3.2: Define artifact retrieval and content-type tests.
- [ ] Task 3.3: Define invariants for original job references, new job IDs, and attempt lineage.

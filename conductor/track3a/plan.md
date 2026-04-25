# Plan: Track 3a - External Browser Backends + Profile Identity Layer

### Phase 1: Architecture and Schema
- [x] Task 1.1: Define the `profile-identity` package boundary and shared types.
- [x] Task 1.2: Define the schema plan for `browser_profiles`, `browser_profile_leases`, `proxies`, and `profile_events`.
- [x] Task 1.3: Define lease ownership, heartbeat, cooldown, quarantine, and orphan-recovery behavior.

### Phase 2: Backend Integration Planning
- [x] Task 2.1: Define `TandemBrowserEngine` as the preferred open external backend.
- [x] Task 2.2: Define how `MultiloginCdpEngine` remains optional and secondary.
- [x] Task 2.3: Define backend capability matrix, startup health probe, and attach/release semantics.

### Phase 3: Policy and Operations Planning
- [x] Task 3.1: Define named-profile, human-session, and operator-handoff requirements.
- [x] Task 3.2: Define profile/proxy validation and cross-tenant isolation rules.
- [x] Task 3.3: Define restart recovery, orphan reconciliation, and operator visibility requirements.

### Phase 4: Verification Plan
- [x] Task 4.1: Define mocked backend integration tests.
- [x] Task 4.2: Define migration smoke tests on a clean DB and existing dev DB.
- [x] Task 4.3: Define end-to-end tests for lease ownership, attach failure, quarantine, and recovery.

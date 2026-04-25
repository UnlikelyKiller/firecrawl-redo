## Plan: Track 0 - Security Baseline + Infrastructure Refresh

### Phase 1: Security Baseline Reconciliation
- [ ] Task 1.1: Reconcile `packages/security` against the updated plan and identify gaps in URL validation, DNS guard, and secret redaction coverage.
- [ ] Task 1.2: Add planning notes for exact-origin exceptions required by optional external browser backends.
- [ ] Task 1.3: Update the threat model to explicitly cover Tandem, external session control, proxy/profile mismatch, and restart recovery.

### Phase 2: Database and Migration Foundation
- [ ] Task 2.1: Ensure schema planning includes `browser_profile_leases`, `proxies`, and `profile_events` in addition to the existing Phase 1 tables.
- [ ] Task 2.2: Define clean-database migration smoke requirements and rollback/forward-fix expectations.
- [ ] Task 2.3: Define seed-data expectations for policy, profile, and proxy fixtures used in later tracks.

### Phase 3: Verification and CI Planning
- [ ] Task 3.1: Expand `changeguard verify` planning to include migration smoke coverage and external-browser compatibility checks when enabled.
- [ ] Task 3.2: Define build/typecheck/test expectations per workspace so later tracks have a common verification contract.
- [ ] Task 3.3: Document environment prerequisites for local-only Tandem validation and feature-flagged external backend tests.

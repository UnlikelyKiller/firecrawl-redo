# Plan: Track 5 - Domain Policy + Egress Controls + External Backend Policy

### Phase 1: Policy Surface Planning
- [ ] Task 1.1: Define the full policy schema for browser mode, session backend, named profile requirements, and operator handoff.
- [ ] Task 1.2: Define robots, login-wall, CAPTCHA, retention, and rate-limit policy interactions.
- [ ] Task 1.3: Define structured policy-decision logging requirements.

### Phase 2: External Backend Policy Planning
- [ ] Task 2.1: Define Tandem eligibility semantics.
- [ ] Task 2.2: Define Multilogin eligibility semantics as optional and secondary.
- [ ] Task 2.3: Define profile identity checks that must pass before any external backend attach.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define unit tests for blocked domains, robots, rate limits, and policy-denied backend selections.
- [ ] Task 3.2: Define API round-trip tests for domain policy CRUD.
- [ ] Task 3.3: Define tests for named-profile and manual-approval behavior.

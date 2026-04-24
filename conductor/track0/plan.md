## Plan: Track 0 - Security Baseline + Infra
### Phase 1: Threat Model & CI Setup
- [x] Task 1.1: Create `docs/threat-model.md` covering SSRF, recipe injection, credential leakage, LLM prompt injection, AGPL boundary, and DNS rebinding.
- [x] Task 1.2: Update `.changeguard/config.toml` to uncomment and add `verify.steps` for `pnpm audit --audit-level high`, `biome check --write=false .`, `pnpm -r run typecheck`, and `pnpm -r run test`.
- [x] Task 1.3: Update `docker-compose.yml` to replace image tags for Firecrawl and Playwright with specific SHA256 digests.
- [x] Task 1.4: Create `skill/SKILL.md` skeleton to define agent workflows.

### Phase 2: Egress Firewall (packages/security)
- [x] Task 2.1: Initialize `packages/security` directory, set up `package.json`, TypeScript config, and add `neverthrow` + `zod` dependencies.
- [x] Task 2.2: Implement `URLValidator` (TDD) using Zod 4 to block private IPs and cloud metadata endpoints.
- [x] Task 2.3: Implement `DNSGuard` (TDD) to resolve hostnames and verify resulting IPs against blocked ranges, returning `neverthrow` Results.
- [x] Task 2.4: Implement `SecretRedactor` (TDD) to securely mask credentials from logs and outputs.

### Phase 3: Database Foundation (Drizzle ORM)
- [x] Task 3.1: Set up Drizzle ORM configuration and database scaffolding in `packages/db` (or equivalent location).
- [x] Task 3.2: Create Drizzle schema for `agent_jobs` and `watch_jobs`.
- [x] Task 3.3: Create Drizzle schema for `webhook_subscriptions` and `webhook_deliveries`.
- [x] Task 3.4: Create Drizzle schema for `engine_attempts`, `page_snapshots` (incorporating content-addressing fields), and `browser_profiles`.
- [x] Task 3.5: Generate and verify Drizzle migrations for all newly created tables.
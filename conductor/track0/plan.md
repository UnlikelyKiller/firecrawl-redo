## Plan: Track 0 - Security Baseline + Infra
### Phase 1: Threat Model & CI Setup
- [ ] Task 1.1: Create `docs/threat-model.md` covering SSRF, recipe injection, credential leakage, LLM prompt injection, AGPL boundary, and DNS rebinding.
- [ ] Task 1.2: Update `.changeguard/config.toml` to uncomment and add `verify.steps` for `pnpm audit --audit-level high`, `biome check --write=false .`, `pnpm -r run typecheck`, and `pnpm -r run test`.
- [ ] Task 1.3: Update `docker-compose.yml` to replace image tags for Firecrawl and Playwright with specific SHA256 digests.
- [ ] Task 1.4: Create `skill/SKILL.md` skeleton to define agent workflows.

### Phase 2: Egress Firewall (packages/security)
- [ ] Task 2.1: Initialize `packages/security` directory, set up `package.json`, TypeScript config, and add `neverthrow` + `zod` dependencies.
- [ ] Task 2.2: Implement `URLValidator` (TDD) using Zod 4 to block private IPs and cloud metadata endpoints.
- [ ] Task 2.3: Implement `DNSGuard` (TDD) to resolve hostnames and verify resulting IPs against blocked ranges, returning `neverthrow` Results.
- [ ] Task 2.4: Implement `SecretRedactor` (TDD) to securely mask credentials from logs and outputs.

### Phase 3: Database Foundation (Drizzle ORM)
- [ ] Task 3.1: Set up Drizzle ORM configuration and database scaffolding in `packages/db` (or equivalent location).
- [ ] Task 3.2: Create Drizzle schema for `agent_jobs` and `watch_jobs`.
- [ ] Task 3.3: Create Drizzle schema for `webhook_subscriptions` and `webhook_deliveries`.
- [ ] Task 3.4: Create Drizzle schema for `engine_attempts`, `page_snapshots` (incorporating content-addressing fields), and `browser_profiles`.
- [ ] Task 3.5: Generate and verify Drizzle migrations for all newly created tables.
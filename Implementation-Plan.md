# CrawlX Implementation Plan v2

> **Status:** DRAFT  
> **Revision:** 2 — incorporates hardening review feedback  
> **Created:** 2026-04-23  
> **Owner:** Ryan (Orchestrator)  
> **License:** CrawlX own code: MIT. Firecrawl upstream: AGPL-3.0 (consumed as service, not forked).  
> **ChangeGuard Category:** ARCHITECTURE

---

## 1. Executive Summary

CrawlX is a self-hosted crawl-operations platform that approximates paid Firecrawl capabilities while remaining local-first and policy-controlled. It wraps Firecrawl OSS with durable job orchestration, a multi-engine waterfall, Playwright browser workers with video receipts, Ollama-backed LLM extraction, compliance controls, Agent Lite, webhooks, change tracking, and an operator dashboard.

The goal is **control, customization, and lower marginal cost for reasonable sites** — not competing with Firecrawl Cloud's Fire-engine anti-bot infrastructure. Where local waterfall exhausts, an optional cloud-escalation seam lets you use paid Firecrawl for hard failures only.

### What Changed from v1

The review correctly identified that v1 was **too conservative on paid-feature parity** and **too trusting of "future Phase 2."** This revision:

1. **Promotes Agent Lite, webhooks, waterfall engine, change-tracking tables, browser action receipts, and egress firewall into Phase 1** — as schemas/interfaces/thin implementations, not just deferred promises.
2. **Adds a Firecrawl v2.8 compatibility layer** — CrawlX exposes `/v2/*` endpoints that route to local orchestration, not just Firecrawl passthrough.
3. **Replaces "retry engine" with "waterfall engine"** — multi-engine fallback is the core architecture, not an afterthought.
4. **Adds content-addressed artifact storage** from day one.
5. **Adds SSRF/egress firewall** as a hard prerequisite before any scrape reaches a browser or HTTP client.
6. **Adds browser profile/session vault** for controlled authenticated workflows.
7. **Adds external browser-session backend seam** — optional, policy-gated, disabled by default. Supports future integrations such as Multilogin without replacing the local browser worker.
8. **Adds Firecrawl Cloud escalation seam** — optional, policy-gated, approval-required.
9. **Focuses on CLI + SKILL.md** for agent integration rather than MCP server. The skill file teaches coding agents (Gemini CLI, Claude Code, Antigravity, Codex) when and how to use CrawlX.
10. **Updates all dependency pins** to verified April 2026 versions, including CVE fixes.
11. **Expands to 10 tracks** with explicit "design the seam now, implement later" discipline.

---

## 2. Tech Stack — Pinned Versions (Verified 2026-04-23)

| Layer | Technology | Version Pin | Notes |
|-------|-----------|-------------|-------|
| **Runtime** | Node.js | `24 LTS` (24.15.x "Krypton") | Active LTS → Apr 2028. Pin via `.node-version`. |
| **Language** | TypeScript | `~5.8` | Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. |
| **Package Manager** | pnpm | `~9.x` | Workspace protocol for monorepo. `pnpm audit` on every CI run. |
| **API Framework** | Fastify | `~5.8.5` | Fixes CVE-2026-33806, CVE-2026-25224, CVE-2026-3635. Use `@fastify/type-provider-zod`. |
| **ORM** | Drizzle ORM | `>=0.45.2 <1.0.0` | Fixes CVE-2026-39356. Do NOT use 1.0.0-beta in production. |
| **Schema Migrations** | drizzle-kit | `~0.30` | `generate` + `migrate` workflow. |
| **Validation** | Zod | `~4.x` | Zod 4 is stable. Firecrawl v2.8 SDK added Zod v4 compat. Single source of truth. |
| **Queue** | BullMQ | `~5.76` | 5.76.1 latest/non-vulnerable. Mandatory explicit Redis connection. |
| **Database** | PostgreSQL | `16` | Docker `postgres:16-alpine`. |
| **Cache/Queue** | Redis | `7.4` | Docker `redis:7.4-alpine`. |
| **Browser** | Playwright | `~1.59` | Screencast, action annotations, agentic video receipts, ARIA snapshots. |
| **LLM Client** | Ollama REST API | Direct `fetch` via adapter | `http://localhost:11434/api/chat`. No SDK dependency. |
| **Default Model** | kimi-k2.6:cloud | Via Ollama cloud | Pluggable via `ModelAdapter` → `ModelRouter`. |
| **Frontend** | React | `^19` | Dashboard only. |
| **Build** | Vite | `~8.0` | Vite 8 stable (Rolldown-based). Verify TailwindCSS plugin compat before locking. |
| **CLI** | Commander.js | `^14.0.3` | Commander 15 is pre-release/ESM-only. Stay on 14. |
| **HTTP Client** | undici (Node built-in) | Node 24 built-in | No axios. |
| **Error Handling** | neverthrow | `^8` | `Result<T, E>` for all fallible operations. |
| **Circuit Breaker** | opossum | `^8` | Wrap every external dependency. |
| **Logging** | pino | `^9` | Structured JSON. Correlation IDs via `AsyncLocalStorage`. |
| **Testing** | Vitest | `^3` | Unit + integration. |
| **Container** | Docker Compose | v2 | Exact image tags, never `:latest` in production. |
| **Firecrawl** | Firecrawl OSS | `v2.8.0` (exact tag) | Pin `ghcr.io/firecrawl/firecrawl:v2.8.0`. Replace with digest after validation. |
| **Code Quality** | Biome | `^1.9` | Replaces ESLint + Prettier. |
| **Git Hooks** | ChangeGuard pre-push | Custom (provided) | Enforces ledger reconciliation before push. |

### Image Pinning Rule

```yaml
# NEVER this:
image: ghcr.io/firecrawl/firecrawl:latest

# ALWAYS this:
image: ghcr.io/firecrawl/firecrawl:v2.8.0
# After local validation, switch to digest:
# image: ghcr.io/firecrawl/firecrawl@sha256:<hash>
```

---

## 3. Engineering Principles — Enforcement

Same as v1 (TDD, SOLID, Composition Over Inheritance, Fail Fast via neverthrow, Immutability by Default, DRY/KISS/Boy Scout Rule) with one addition:

**Design the seam now, implement later.** For every capability deferred from full implementation (Agent, change tracking, cloud escalation), the database tables, TypeScript interfaces, Zod schemas, and route stubs exist in Phase 1. This prevents painting yourself into a corner. The stub returns `501 Not Implemented` with a structured error body until the track activates.

---

## 4. Directory Structure (Revised)

```
crawlx/
├── .changeguard/
│   └── config.toml
├── conductor/
│   ├── conductor.md
│   └── track-{00..09}/
├── docs/
│   ├── Implementation-Plan.md
│   ├── architecture.md
│   ├── threat-model.md
│   ├── domain-policy.md
│   └── adr/
├── apps/
│   ├── api/                          # Fastify API — Firecrawl v2-compatible surface
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── config.ts             # Typed env config via Zod 4
│   │   │   ├── routes/
│   │   │   │   ├── v2/               # Firecrawl v2-compatible endpoints
│   │   │   │   │   ├── scrape.route.ts
│   │   │   │   │   ├── crawl.route.ts
│   │   │   │   │   ├── map.route.ts
│   │   │   │   │   ├── search.route.ts
│   │   │   │   │   ├── extract.route.ts
│   │   │   │   │   ├── batch-scrape.route.ts
│   │   │   │   │   ├── agent.route.ts     # Stub → Track 6
│   │   │   │   │   └── interact.route.ts  # Stub → Track 3
│   │   │   │   ├── jobs.route.ts
│   │   │   │   ├── pages.route.ts
│   │   │   │   ├── domains.route.ts
│   │   │   │   ├── webhooks.route.ts      # Stub → Track 6
│   │   │   │   ├── stats.route.ts
│   │   │   │   └── health.route.ts
│   │   │   ├── workers/
│   │   │   │   ├── scrape.worker.ts
│   │   │   │   ├── crawl.worker.ts
│   │   │   │   ├── extract.worker.ts
│   │   │   │   ├── browser.worker.ts
│   │   │   │   ├── agent.worker.ts        # Track 6
│   │   │   │   └── webhook.worker.ts      # Track 6
│   │   │   └── plugins/
│   │   │       ├── correlation-id.ts
│   │   │       └── error-handler.ts
│   │   └── package.json
│   ├── web/                           # React + Vite 8 dashboard
│   │   └── (same as v1, expanded in Track 7)
│   ├── cli/                           # Commander.js CLI
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── commands/
│   │   │       ├── scrape.ts
│   │   │       ├── crawl.ts
│   │   │       ├── map.ts
│   │   │       ├── search.ts
│   │   │       ├── extract.ts
│   │   │       ├── agent.ts           # Track 6
│   │   │       ├── replay.ts
│   │   │       ├── policy.ts
│   │   │       ├── watch.ts           # Track 9
│   │   │       └── export.ts
│   │   └── package.json
│   └── browser-worker/               # Playwright worker with receipts
│       ├── src/
│       │   ├── server.ts
│       │   ├── browser-pool.ts
│       │   ├── recipe-runner.ts
│       │   ├── artifact-capture.ts    # Screenshots + screencast + ARIA + HAR
│       │   ├── receipt.ts             # Video receipt assembly
│       │   ├── sandbox.ts
│       │   └── session-vault.ts       # Encrypted browser profiles
│       ├── Dockerfile
│       └── package.json
│   ├── multilogin-bridge/            # Optional host-native CDP bridge (not dockerized by default)
│   │   ├── README.md
│   │   └── src/
│   │       └── (bridge implementation)
├── packages/
│   ├── core/                          # Domain types, value objects, errors
│   │   └── src/
│   │       ├── types/
│   │       │   ├── job.ts
│   │       │   ├── page.ts
│   │       │   ├── extraction.ts
│   │       │   ├── policy.ts
│   │       │   ├── failure.ts
│   │       │   ├── recipe.ts
│   │       │   ├── webhook.ts
│   │       │   ├── agent.ts           # AgentJob, AgentStep, AgentBudget
│   │       │   └── change.ts          # ChangeSnapshot, ChangeDiff
│   │       ├── value-objects/
│   │       │   ├── url.ts
│   │       │   ├── content-hash.ts
│   │       │   ├── resource-budget.ts
│   │       │   └── correlation-id.ts
│   │       └── errors.ts
│   ├── db/                            # Drizzle schema + migrations
│   │   └── src/schema/
│   │       ├── jobs.ts
│   │       ├── pages.ts
│   │       ├── page-snapshots.ts      # Content-addressed snapshots for change tracking
│   │       ├── extractions.ts
│   │       ├── domain-policies.ts
│   │       ├── llm-calls.ts
│   │       ├── browser-sessions.ts
│   │       ├── browser-profiles.ts    # Session vault / external session backend metadata
│   │       ├── browser-profile-leases.ts # Ownership + TTL for external browser sessions
│   │       ├── failure-events.ts
│   │       ├── engine-attempts.ts     # Waterfall engine tracking
│   │       ├── webhook-subscriptions.ts
│   │       ├── webhook-deliveries.ts
│   │       ├── agent-jobs.ts          # Agent-specific state
│   │       └── watch-jobs.ts          # Scheduled recrawls
│   ├── firecrawl-client/              # Talks to upstream Firecrawl OSS
│   │   └── src/
│   │       ├── client.ts
│   │       ├── health.ts
│   │       └── index.ts
│   ├── firecrawl-compat/              # Defines CrawlX's v2-compatible API surface
│   │   └── src/
│   │       ├── schemas.ts             # Zod 4 schemas matching Firecrawl v2.8 shapes
│   │       ├── options.ts             # sitemapOnly, ignoreCache, customHeaders, formats
│   │       └── index.ts
│   ├── waterfall-engine/              # Multi-engine fallback orchestrator
│   │   └── src/
│   │       ├── engine.ts              # CrawlEngine interface
│   │       ├── waterfall.ts           # WaterfallOrchestrator
│   │       ├── engines/
│   │       │   ├── firecrawl-static.ts
│   │       │   ├── firecrawl-js.ts
│   │       │   ├── firecrawl-playwright.ts
│   │       │   ├── crawlx-playwright.ts
│   │       │   ├── crawlx-branded-browser.ts
│   │       │   ├── multilogin-cdp.ts   # Optional external-session engine
│   │       │   ├── crawlx-recipe.ts
│   │       │   ├── firecrawl-cloud.ts  # Optional escalation adapter
│   │       │   └── manual-review.ts
│   │       └── index.ts
│   ├── model-adapter/                 # LLM abstraction
│   │   └── src/
│   │       ├── adapter.ts             # ModelAdapter interface
│   │       ├── router.ts              # ModelRouter (capability-based selection)
│   │       ├── capabilities.ts        # text, vision, tools, json, cheap, fallback
│   │       ├── ollama.ts
│   │       ├── openai-compat.ts
│   │       ├── prompts/               # Versioned prompt templates
│   │       └── index.ts
│   ├── policy/                        # Domain policy + egress
│   │   └── src/
│   │       ├── engine.ts
│   │       ├── robots.ts
│   │       ├── rate-limiter.ts
│   │       └── index.ts
│   ├── security/                      # Egress firewall, URL validation, SSRF guard
│   │   └── src/
│   │       ├── egress-policy.ts       # EgressPolicy interface
│   │       ├── url-validator.ts       # Block private IPs, metadata endpoints
│   │       ├── dns-guard.ts           # DNS rebinding protection
│   │       ├── secret-redactor.ts     # Redact secrets from logs/artifacts
│   │       └── index.ts
│   ├── artifact-store/                # Content-addressed artifact persistence
│   │   └── src/
│   │       ├── store.ts               # ArtifactStore interface
│   │       ├── content-addressed.ts   # SHA-256 → sha256/ab/cd/<hash>.ext
│   │       ├── filesystem.ts
│   │       ├── s3-compat.ts           # Stub
│   │       └── index.ts
│   ├── webhooks/                      # Webhook dispatch + delivery
│   │   └── src/
│   │       ├── dispatcher.ts
│   │       ├── signer.ts              # HMAC signatures
│   │       └── index.ts
│   ├── search-provider/               # Pluggable search for Agent
│   │   └── src/
│   │       ├── provider.ts            # SearchProvider interface
│   │       ├── searxng.ts
│   │       ├── brave.ts               # Stub
│   │       ├── manual-seeds.ts
│   │       └── index.ts
│   ├── change-tracking/               # Hash/markdown/schema-field diffs
│   │   └── src/
│   │       ├── tracker.ts
│   │       ├── hash-diff.ts
│   │       ├── markdown-diff.ts
│   │       ├── schema-diff.ts         # Track 9
│   │       └── index.ts
│   └── usage-meter/                   # Per-job cost estimation + activity logs
│       └── src/
│           ├── meter.ts
│           └── index.ts
├── skill/                             # CrawlX Skill for coding agents
│   └── SKILL.md                       # Instructions for Gemini CLI, Claude Code, etc.
├── infra/
│   └── docker/
│       ├── browser-worker.Dockerfile
│       └── api.Dockerfile
├── recipes/
│   └── examples/
├── schemas/
│   └── examples/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .node-version
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
├── turbo.json
├── LICENSE
├── LICENSE-NOTICE.md
└── README.md
```

---

## 5. Conductor Tracks (Revised — 10 Tracks)

### Track Status Board

| Track | Name | Status | Depends On | Exit Criteria |
|-------|------|--------|------------|---------------|
| 0 | Security baseline + infra | COMPLETED | — | Docker up, health checks pass, egress firewall blocks `127.0.0.1`, DB migrated, SBOM generated |
| 1 | Firecrawl v2 compat + durable jobs | COMPLETED | 0 | CLI scrapes URL via `/v2/scrape`; job persists; content-addressed artifact stored; BullMQ Board shows it |
| 2 | Durable job model + artifact persistence + replay | COMPLETED | 1 | Failed job replays; artifacts deduplicated by content hash; job events logged |
| 3 | Waterfall engine + Playwright worker + receipts | PLANNED | 1, 2 | JS-heavy page falls through to Playwright; video receipt + ARIA snapshot stored; engine attempt recorded |
| 4 | ModelAdapter + structured extraction | PLANNED | 1 | URL + Zod 4 schema → validated JSON; 3-pass pipeline; LLM calls logged with cost estimate |
| 5 | Domain policy + egress controls | PLANNED | 1 | Blocked domain → 403; robots-disallowed → skipped; private IP → egress denied; rate limit enforced |
| 6 | Agent Lite + search + webhooks | PLANNED | 3, 4, 5 | Prompt with no URL → search → scrape → extract → JSON with sources; webhook delivered with HMAC |
| 7 | Dashboard + activity logs + CLI polish | PLANNED | 1–6 | Custom React dashboard with jobs/pages/failures/domains/extractions/activity/receipts |
| 8 | CLI hardening + CrawlX SKILL.md | PLANNED | 1–6 | All CLI commands tested; SKILL.md validated by agent dry run |
| 9 | Change tracking + scheduled recrawls | PLANNED | 1, 2 | Hash diff detects changed page; markdown diff shows delta; watch job recrawls on schedule |

Optional seam note:
- Multilogin is not a core dependency. If adopted, it enters as a policy-gated external browser-session backend with its own compatibility matrix, lease model, and host-bridge threat controls.

---

### Track 0: Security Baseline + Infrastructure [COMPLETED]

**Category:** INFRA  
**Objective:** Establish the repo, Docker, DB, ChangeGuard, CI gate, and — critically — the egress firewall that must exist before any scrape attempt.

#### Deliverables

Everything from v1 Track 0, plus:

1. `packages/security/` — egress firewall implementation:
   - **URL validator** blocks: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `localhost`, `host.docker.internal`, cloud metadata IPs (`169.254.169.254`), `file://`, `ftp://`, `chrome://`, `devtools://`.
   - If the optional external browser-session backend is enabled, add a disabled-by-default fixed-origin exception for the approved host bridge only. Never broadly allow `host.docker.internal`.
   - **DNS guard** — after DNS resolution, verify resolved IP is not in blocked ranges (prevents DNS rebinding).
   - **Secret redactor** — scrubs API keys, passwords, tokens from logs and stored artifacts.
2. CI steps added to `changeguard verify`:
   ```bash
   pnpm audit --audit-level high
   biome check --write=false .
   pnpm -r run typecheck
   pnpm -r run test
   ```
3. Docker image digest pinning for Firecrawl and Playwright.
4. All DB tables for Phase 1 tracks — including stubs for `agent_jobs`, `webhook_subscriptions`, `webhook_deliveries`, `watch_jobs`, `engine_attempts`, `page_snapshots`, `browser_profiles`.
5. `skill/SKILL.md` skeleton (populated in Track 8).
6. `docs/threat-model.md` with SSRF, recipe injection, credential leakage, LLM prompt injection, AGPL boundary, and DNS rebinding sections.

#### Tests Required

- **Unit:** URL validator — blocks every private range, cloud metadata, non-HTTP schemes. Allows valid public URLs.
- **Unit:** DNS guard — mock DNS resolution returning `127.0.0.1` for `evil.com` → blocked.
- **Unit:** Secret redactor — redacts `Bearer <token>` from strings.
- **Integration:** Drizzle migrations apply cleanly; all tables exist; seed data inserts.
- **Integration:** Docker Compose health checks pass for Postgres, Redis, Firecrawl.
- **Contract:** Firecrawl `/v1/scrape` response validates against `packages/firecrawl-compat/src/schemas.ts`.

---

### Track 1: Firecrawl v2.8 Compatibility + Durable Jobs [COMPLETED]

**Category:** FEATURE  
**Objective:** Expose Firecrawl v2-compatible endpoints that route through CrawlX's own job system. Support v2.8 options: `sitemapOnly`, `ignoreCache`, `customHeaders`, `formats`, `timeoutMs`.

#### Deliverables

1. `packages/firecrawl-compat/` — Zod 4 schemas matching Firecrawl v2.8 request/response shapes for `/v2/scrape`, `/v2/crawl`, `/v2/map`, `/v2/search`, `/v2/batch/scrape`.
2. `packages/firecrawl-client/` — typed wrapper calling upstream Firecrawl OSS with circuit breaker.
3. `apps/api/src/routes/v2/` — all v2 endpoints. For this track, they route directly to Firecrawl OSS. Agent/interact return `501`.
4. `packages/artifact-store/src/content-addressed.ts` — content-addressed storage: `data/artifacts/sha256/{first2}/{next2}/{hash}.{ext}`. DB stores hash pointers.
5. Durable job lifecycle: `QUEUED → RUNNING → COMPLETED | FAILED | COMPLETED_WITH_WARNINGS | CANCELLED`.
6. `apps/cli/src/commands/scrape.ts` — `crawlx scrape <url> [--format markdown|html|json|screenshot]`.
7. BullMQ Board at `/admin/queues`.

#### v2.8 Parity Options

```typescript
interface ScrapeOptions {
  readonly formats: ReadonlyArray<'markdown' | 'html' | 'rawHtml' | 'screenshot' | 'json' | 'links' | 'metadata' | 'images'>;
  readonly sitemapOnly?: boolean;
  readonly ignoreCache?: boolean;
  readonly customHeaders?: Readonly<Record<string, string>>;  // Redacted in logs
  readonly timeoutMs?: number;  // Minimum clamp: 5000
  readonly waitFor?: number;
  readonly includeTags?: ReadonlyArray<string>;
  readonly excludeTags?: ReadonlyArray<string>;
}
```

#### Tests Required

- **Unit:** Firecrawl compat schemas — validate against real Firecrawl v2 response fixtures.
- **Unit:** Content-addressed store — same content produces same hash; different content produces different hash; file stored at correct path.
- **Integration:** `POST /v2/scrape` → job created → worker processes → artifacts stored with content hash → `GET /v2/jobs/:id` returns `COMPLETED` with artifact refs.
- **Integration:** `sitemapOnly: true` option passed through to Firecrawl correctly.
- **CLI:** `crawlx scrape https://example.com` exits 0, prints markdown.

---

### Track 2: Job Model Hardening + Replay + Activity Logs [COMPLETED]

**Category:** FEATURE  
**Objective:** Make jobs fully replayable, add engine attempt tracking, and add activity logs from day one.

#### Deliverables

1. `packages/db/src/schema/engine-attempts.ts` — every scrape attempt records: engine name, input, output artifact hashes, failure class, latency ms, cost estimate, reason for next attempt.
2. Replay endpoint: `POST /v1/replay/:jobId` — re-enqueues a failed job with same config. New job references original.
3. Activity log: every API call logged to `activity_log` table with: timestamp, endpoint, API key (if used), correlation ID, response status, latency.
4. `packages/usage-meter/` — per-job cost estimation based on LLM tokens, browser seconds, and pages scraped.
5. Resource budget enforcement at queue level — job fails with `budget_exceeded` when any limit hit.

#### Tests Required

- **Unit:** Resource budget — under limit passes; at limit fails.
- **Integration:** Failed job → `POST /v1/replay/:jobId` → new job created with same config → processes.
- **Integration:** Activity log populated after API call.

---

### Track 3: Waterfall Engine + Playwright Worker + Video Receipts [COMPLETED]

**Category:** FEATURE  
**Objective:** Replace simple "retry" with a multi-engine waterfall. Add Playwright 1.59 video receipts, ARIA snapshots, and session vault. Design an optional external browser-session backend seam without making it a core dependency.

#### Waterfall Ladder

```
Engine 1: Firecrawl static scrape (no JS)
Engine 2: Firecrawl with JS/rendering enabled
Engine 3: Firecrawl's own Playwright service
Engine 4: CrawlX Playwright worker — headless Chromium
Engine 5: CrawlX Playwright worker — branded Chrome/Edge
Engine 6: Optional Multilogin CDP engine (policy-gated, disabled by default)
Engine 7: CrawlX browser recipe execution
Engine 8: Manual review queue
Engine 9: Firecrawl Cloud escalation (optional, policy-gated)
```

#### Deliverables

1. `packages/waterfall-engine/` — `CrawlEngine` interface + `WaterfallOrchestrator`:
   ```typescript
   interface CrawlEngine {
     readonly name: string;
     supports(input: ScrapeInput): boolean;
     scrape(input: ScrapeInput): Promise<Result<ScrapeOutput, CrawlFailure>>;
   }
   ```
2. Engine implementations: `FirecrawlStaticEngine`, `FirecrawlJsEngine`, `CrawlxPlaywrightEngine`, `CrawlxBrandedBrowserEngine`, optional `MultiloginCdpEngine`, `CrawlxRecipeEngine`, `ManualReviewEngine`, `FirecrawlCloudEngine` (stub).
3. `apps/browser-worker/` — Playwright 1.59 worker with:
   - Screenshots (full page + viewport)
   - Rendered HTML
   - Visible text
   - ARIA snapshot (`page.accessibility.snapshot()`)
   - HAR network log
   - Console log capture
   - **Screencast video receipt** (`page.screencast`)
   - Action timeline JSON
   - Before/after screenshots for recipe steps
4. `apps/browser-worker/src/session-vault.ts` — encrypted browser profile storage:
   - Profiles encrypted at rest (AES-256-GCM via Node crypto)
   - Domain-scoped, expiration date, manual approval before use
   - Never exposed to LLM prompts
   - Cannot be used on blocked domains
5. Optional external browser-session backend seam:
   - `MultiloginCdpEngine` attaches through Playwright `connectOverCDP()`
   - Capability-gated: do not assume video/HAR/tracing parity with native Playwright sessions
   - Use a lease model so one external profile is not shared across jobs accidentally
   - Prefer Multilogin official API for lifecycle; use a fixed-origin host bridge only when needed for host-local CDP access
6. Recipe execution modes: `dry_run`, `recorded_run`, `trusted_run`, `manual_assist`.
7. `packages/db/src/schema/browser-profiles.ts` and `browser-profile-leases.ts` — session backend and ownership tables.
8. Failure classifier — every engine failure mapped to a `FailureClass` discriminated union.

#### Browser Worker Artifact Bundle

```typescript
interface ArtifactBundle {
  readonly rawHtml: string;
  readonly renderedHtml: string;
  readonly markdown: string;
  readonly visibleText: string;
  readonly screenshotFull: Buffer;
  readonly screenshotViewport: Buffer;
  readonly ariaSnapshot: object;
  readonly har: object;
  readonly consoleLog: ReadonlyArray<string>;
  readonly videoReceipt?: Buffer;          // .webm screencast
  readonly actionTimeline?: ReadonlyArray<ActionStep>;
  readonly metadata: PageMetadata;
}
```

#### Security Hardening

- Browser worker Docker container: separate network, non-root user, `deploy.resources.limits` (2 CPU, 4GB RAM).
- Recipe sandbox: allowlisted actions only (`goto`, `click`, `fill`, `press`, `select`, `waitForSelector`, `scroll`, `screenshot`, `extractHtml`, `extractText`). No `page.evaluate()` with arbitrary code.
- 30-second timeout per step, 120 seconds per recipe.
- Egress policy checked before every `goto`.
- External browser-session backends are disabled by default and require a fixed-origin bridge exception plus explicit domain policy approval.

#### Tests Required

- **Unit:** `WaterfallOrchestrator` — engine 1 fails → engine 2 tried → succeeds → engine attempt recorded.
- **Unit:** `CrawlEngine` LSP — all implementations pass same contract test.
- **Unit:** Recipe sandbox — valid recipe passes; `evaluate` step rejected; timeout enforced.
- **Unit:** Session vault — encrypt/decrypt round-trip; expired profile rejected; blocked domain rejected.
- **Unit:** External session lease prevents double-attach of the same profile.
- **Integration:** JS-heavy page → Firecrawl returns empty → waterfall escalates to Playwright → video receipt stored.
- **Integration:** Optional external-session engine attaches over CDP and returns a tested capability matrix.
- **Integration:** All engines down → job marked `manual_review`.
- **E2E:** Docker Compose runs browser worker; API waterfall reaches it; artifacts stored with content hash.

---

### Track 4: ModelAdapter + Structured Extraction [COMPLETED]

**Category:** FEATURE  
**Objective:** Three-pass extraction pipeline with a capability-aware model router.

#### Deliverables

1. `packages/model-adapter/` with:
   - `ModelAdapter` interface (ISP — split by capability):
     ```typescript
     interface TextExtractor { extractJson(markdown: string, schema: ZodSchema): Promise<Result<ExtractionResult, ExtractionError>>; }
     interface JsonRepairer { repairJson(invalid: string, errors: ZodError, schema: ZodSchema): Promise<Result<ExtractionResult, ExtractionError>>; }
     interface PageClassifier { classifyPageRelevance(markdown: string, task: string): Promise<Result<RelevanceScore, ExtractionError>>; }
     interface VisualAnalyzer { analyzeScreenshot(image: Buffer, task: string): Promise<Result<ExtractionResult, ExtractionError>>; }
     ```
   - `ModelRouter` — selects model by capability flags: `text`, `vision`, `tools`, `json`, `long_context`, `cheap`, `fallback`.
   - `OllamaAdapter` and `OpenAICompatAdapter` implementations.
2. Three-pass extraction: Extract → Validate (Zod 4) → Repair (max 2 attempts).
3. Extraction prompts versioned in `packages/model-adapter/src/prompts/`. User content NEVER in system message.
4. Confidence scoring per field, source quotes, `null` for absent fields.
5. `POST /v2/extract` endpoint.
6. LLM call logging: model, tokens in/out, latency, cost estimate, correlation ID.

#### Tests Required

- **Unit:** Three-pass pipeline — valid on first try; invalid triggers repair; 2 repair failures → `ExtractionFailed`.
- **Unit:** Prompt injection — adversarial markdown doesn't escape user message context.
- **Unit:** `ModelRouter` — selects vision-capable model for screenshot task; selects cheap model for classification.
- **Contract:** `OllamaAdapter` and `OpenAICompatAdapter` both pass `TextExtractor` contract tests (LSP).
- **Integration:** Extract pricing data from HTML fixture → validates against pricing schema.

---

### Track 5: Domain Policy + Egress Controls [COMPLETED]

**Category:** FEATURE  
**Objective:** Per-domain crawl policies with the compliant path as the easy path.

#### Deliverables

1. `packages/policy/` — `PolicyEngine` that evaluates URL against:
   - robots.txt (cached 24h)
   - Domain allow/block list
   - Path allow/block (glob patterns)
   - Rate limits (per-domain sliding window via Redis)
   - Login wall policy
   - CAPTCHA policy
   - Retention policy
   - Browser mode policy
   - Session backend policy
   - Manual approval gate
2. **Three-layer egress enforcement:**
   - Layer 1: URL validation before enqueue (`packages/security/url-validator.ts`)
   - Layer 2: DNS resolution check before request (`packages/security/dns-guard.ts`)
   - Layer 3: Container network-level block (Docker network config)
3. Default blocked domains: social media (Instagram, TikTok, YouTube), *.gov login-walled pages.
4. Optional policy fields for approved domains:
   - `browser_mode: standard | branded | multilogin_required`
   - `session_backend: crawlx_local | multilogin`
   - `requires_named_profile`
   - `requires_manual_approval`
5. `PUT /v2/domains/:domain/policy` and `GET /v2/domains/:domain/policy` endpoints.
6. Policy decisions logged to `policy_decisions` table.

#### Tests Required

- **Unit:** Blocked domain → `policy_denied`. Robots-disallowed → `robots_blocked`. Rate exceeded → `rate_limited`.
- **Unit:** Glob path matching — `/admin/*` blocks `/admin/settings`, allows `/public`.
- **Integration:** Scrape blocked domain → 403 with structured error.
- **Integration:** Scrape robots-disallowed path → skipped with reason.

---

### Track 6: Agent Lite + Search + Webhooks [COMPLETED]

**Category:** FEATURE  
**Objective:** Bounded agent job type that approximates Firecrawl Cloud `/agent`. Plus webhook delivery.

#### Agent Lite Design

```typescript
interface AgentJobConfig {
  readonly prompt: string;
  readonly outputSchema?: ZodSchema;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly blockedDomains?: ReadonlyArray<string>;
  readonly searchProvider: 'searxng' | 'brave' | 'manual';
  readonly maxSearchQueries: number;     // default: 5
  readonly maxCandidateUrls: number;     // default: 20
  readonly maxScrapes: number;           // default: 10
  readonly maxBrowserActions: number;    // default: 5
  readonly maxLlmCalls: number;          // default: 30
  readonly maxRuntimeSeconds: number;    // default: 300
  readonly webhookUrl?: string;
  readonly model?: string;
}
```

Agent loop:

```
1. Kimi plans search queries from prompt
2. Search via configured provider
3. Rank candidate URLs (Kimi)
4. Apply domain policy to candidates
5. Scrape top URLs (through waterfall engine)
6. Browser fallback if needed
7. Extract structured result (through extraction pipeline)
8. Validate against outputSchema if provided
9. Synthesize final answer with source citations
10. Deliver webhook if configured
11. Return JSON + sources + warnings + artifact refs
```

#### Webhook System

1. `packages/webhooks/` — HMAC-signed delivery with retry (3 attempts, exponential backoff).
2. Events: `job.created`, `job.started`, `job.progress`, `job.completed`, `job.failed`, `agent.step.completed`, `extraction.completed`.
3. Idempotency key per delivery.
4. Local webhooks disabled unless `ALLOW_LOCAL_WEBHOOKS=true`.
5. Redacted payload mode available.

#### Deliverables

1. `packages/search-provider/` — `SearchProvider` interface + SearXNG implementation + manual seed fallback.
2. `apps/api/src/routes/v2/agent.route.ts` — `POST /v2/agent` + `GET /v2/agent/:id`.
3. `apps/api/src/workers/agent.worker.ts` — BullMQ Flow job with stages: `plan → search → rank → scrape → extract → synthesize → webhook`.
4. `apps/api/src/routes/webhooks.route.ts` — CRUD for webhook subscriptions.
5. `apps/cli/src/commands/agent.ts` — `crawlx agent "Find pricing plans for Notion"`.

#### Tests Required

- **Unit:** Agent budget enforcement — exceeding any limit stops the loop.
- **Unit:** Webhook HMAC signature — verify signature matches payload.
- **Integration:** Agent prompt → search returns results → top URL scraped → extraction produced → webhook delivered.
- **Integration:** Agent with `maxScrapes: 1` → only 1 page scraped despite 10 candidates.
- **Integration:** Webhook delivery failure → retried → logged.

---

### Track 7: Dashboard + Activity Logs [COMPLETED]

**Category:** FEATURE  
**Objective:** Custom React dashboard with paid-like operator features.

#### Pages

- **Jobs:** List with filters (state, type, date range, API key). Click → Job Detail.
- **Job Detail:** State, seed URLs, engine attempts (waterfall visualization), artifacts (download + inline view), extraction result, LLM call log, cost estimate, "Replay" button.
- **Pages:** Scraped pages with content hash, change indicator, artifact links.
- **Failures:** Grouped by error class and domain. Top failing domains. Per-engine success rate.
- **Domains:** Policy CRUD. Last scrape date, failure rate, rate limit state.
- **Extractions:** Schema used, validation status, confidence scores.
- **Activity Log:** All API calls with endpoint, key, correlation ID, latency.
- **Usage:** Daily cost approximation (LLM tokens, browser seconds, pages).
- **Browser Receipts:** Video receipt viewer for browser actions.

#### Tests Required

- **E2E (Playwright Test):** Dashboard loads; Jobs page shows completed job; Job Detail shows waterfall; Failures grouped by class; Activity log populated.

---

### Track 8: CLI Hardening + CrawlX SKILL.md [COMPLETED]

**Category:** FEATURE  
**Objective:** Complete CLI with all commands. Produce a SKILL.md that teaches coding agents to use CrawlX.

#### CLI Commands (Final)

```powershell
crawlx scrape <url> [--format markdown|html|json|screenshot] [--timeout 30000]
crawlx crawl <url> [--limit 100] [--sitemapOnly] [--ignoreCache]
crawlx map <url> [--ignoreCache]
crawlx search <query> [--limit 10]
crawlx extract <url> --schema <path> [--model kimi-k2.6:cloud]
crawlx agent "<prompt>" [--schema <path>] [--max-pages 10]
crawlx replay <job-id>
crawlx status <job-id>
crawlx export <job-id> --format markdown|json|artifacts
crawlx policy set <domain> --delay 3000 --concurrency 2 [--block-paths "/admin/*"]
crawlx policy get <domain>
crawlx policy list
crawlx watch <url> --interval 24h [--schema <path>] [--webhook <url>]
crawlx failures [--domain <domain>] [--class <failure-class>]
crawlx health
crawlx up                              # Start Docker services
crawlx down                            # Stop Docker services
```

#### SKILL.md Content

```markdown
# skill/SKILL.md
---
name: crawlx
description: Use CrawlX for web scraping, crawling, structured extraction, browser
  automation, and agentic web research. Trigger when an agent needs web content,
  structured data from a URL, or needs to monitor pages for changes.
---

# CrawlX — Agent Skill

CrawlX is a local-first crawl operations platform. Use the CLI to scrape, crawl,
extract, and research web content.

## When to Use

- **Scrape a single page:** `crawlx scrape <url>`
- **Crawl a site:** `crawlx crawl <url> --limit N`
- **Extract structured data:** `crawlx extract <url> --schema schema.json`
- **Research a topic (no URL known):** `crawlx agent "Find pricing for Notion"`
- **Monitor a page for changes:** `crawlx watch <url> --interval 24h`
- **Replay a failed job:** `crawlx replay <job-id>`

## When NOT to Use

- Internal/authenticated company pages (use appropriate internal tools)
- Social media scraping (blocked by default policy)
- Bulk scraping without domain policy (set policy first)

## Common Patterns

### Get markdown from a URL
```bash
crawlx scrape https://example.com --format markdown
```

### Extract structured data
```bash
# Create schema file
cat > pricing.json << 'EOF'
{ "plans": [{ "name": "string", "price": "string", "features": ["string"] }] }
EOF
crawlx extract https://example.com/pricing --schema pricing.json
```

### Research without a URL
```bash
crawlx agent "Find the current pricing plans for Notion" --max-pages 5
```

### Check job status
```bash
crawlx status <job-id>
```

### Export artifacts
```bash
crawlx export <job-id> --format artifacts
```

## Safety Rules

- Always set domain policy before bulk crawling a new domain
- Respect robots.txt (enforced by default)
- Do not attempt to bypass login walls or CAPTCHAs
- Do not scrape blocked domains (social media, etc.)
- Check `crawlx health` before starting large jobs

## Error Handling

If a scrape fails, CrawlX automatically tries multiple engines (Firecrawl → Playwright
→ branded browser). Check the failure class with `crawlx failures --domain <domain>`.
```

#### Tests Required

- **CLI:** Every command exits 0 on success, 1 on failure. Structured JSON output when `--json` flag used.
- **SKILL.md:** Validate all example commands execute successfully against a running CrawlX instance.

---

### Track 9: Change Tracking + Scheduled Recrawls [COMPLETED]

**Category:** FEATURE  
**Objective:** Detect content changes across recrawls. Support scheduled watch jobs.

#### Deliverables

1. `packages/change-tracking/` — three diff levels:
   - **Level 1:** Content hash comparison (instant).
   - **Level 2:** Markdown diff (line-level delta).
   - **Level 3:** Schema-field diff (if extraction schema provided — shows which fields changed with old/new values).
2. `packages/db/src/schema/page-snapshots.ts` — snapshots linked to pages by content hash + timestamp.
3. `packages/db/src/schema/watch-jobs.ts` — scheduled recrawl definitions: URL, interval, schema, webhook URL.
4. Watch job worker — runs on BullMQ repeatable jobs.
5. `crawlx watch <url> --interval 24h` CLI command.
6. Webhook on change detection.

#### Change Diff Output

```typescript
interface ChangeDiff {
  readonly url: string;
  readonly changed: boolean;
  readonly hashDiff: { readonly old: string; readonly new: string } | null;
  readonly markdownDiff: string | null;       // Unified diff format
  readonly fieldChanges: ReadonlyArray<{
    readonly field: string;
    readonly old: unknown;
    readonly new: unknown;
    readonly confidence: number;
  }> | null;
  readonly previousSnapshot: string;          // Content hash
  readonly currentSnapshot: string;           // Content hash
  readonly detectedAt: Date;
}
```

#### Tests Required

- **Unit:** Hash diff — same content → `changed: false`; different content → `changed: true`.
- **Unit:** Markdown diff — added paragraph detected; removed paragraph detected.
- **Integration:** Scrape page → modify fixture → rescrape → change detected → webhook fired.

---

## 6. Firecrawl Cloud Escalation Seam

Added as an **optional, policy-gated** escape hatch. Not a core dependency.

#### Configuration

```bash
# .env
FIRECRAWL_CLOUD_API_KEY=              # Empty = disabled
FIRECRAWL_CLOUD_ESCALATION=false      # Must be explicitly enabled
FIRECRAWL_CLOUD_REQUIRE_APPROVAL=true # Require per-domain approval
FIRECRAWL_CLOUD_MAX_CREDITS_DAY=100   # Daily budget cap
```

#### Escalation Policy

```typescript
type EscalationPolicy = 'never' | 'local_first' | 'cloud_on_failure' | 'manual_approval_only';
```

The `FirecrawlCloudEngine` in the waterfall is **always last** and only activates when:

1. All local engines exhausted.
2. `FIRECRAWL_CLOUD_ESCALATION=true`.
3. Domain policy permits cloud processing.
4. Content sensitivity permits external processing.
5. Daily credit budget not exceeded.
6. If `REQUIRE_APPROVAL=true`, domain has explicit cloud-allow flag.

This gives near-paid capability when needed without turning the project into a paid API wrapper.

---

## 7. SSRF / Egress Firewall — Concrete Implementation

This is a hard prerequisite. No scrape reaches any engine without passing egress validation.

#### Blocked Ranges

```typescript
const BLOCKED_CIDRS = [
  '127.0.0.0/8',       // Loopback
  '10.0.0.0/8',        // Private A
  '172.16.0.0/12',     // Private B
  '192.168.0.0/16',    // Private C
  '169.254.0.0/16',    // Link-local
  '::1/128',           // IPv6 loopback
  'fc00::/7',          // IPv6 ULA
  'fe80::/10',         // IPv6 link-local
] as const;

const BLOCKED_HOSTS = [
  'localhost',
  'host.docker.internal',
  'metadata.google.internal',
  '169.254.169.254',   // AWS/GCP/Azure metadata
] as const;

const BLOCKED_SCHEMES = ['file:', 'ftp:', 'chrome:', 'devtools:', 'data:'] as const;
```

If the optional external browser-session backend is enabled:

- keep `host.docker.internal` blocked by default
- allow only the configured fixed-origin bridge endpoint
- do not expose raw host CDP ports unless explicitly enabled for a tested deployment

#### Enforcement Points

1. **Pre-enqueue:** `urlValidator.validate(url)` before job creation.
2. **Pre-request:** `dnsGuard.validateResolved(url, resolvedIp)` immediately before HTTP/browser request.
3. **Container network:** Browser worker in isolated Docker network with explicit allowlist.

---

## 8. Content-Addressed Artifact Storage

From day one, all artifacts use content-addressed paths:

```
data/artifacts/sha256/ab/cd/abcdef1234567890....html
data/artifacts/sha256/ef/12/ef1234567890abcdef....md
data/artifacts/sha256/01/23/01234567890abcdef....png
```

#### Benefits

- **Deduplication:** Same page scraped twice = same hash = stored once.
- **Change detection:** Compare hashes to detect changes instantly.
- **Replay:** All inputs preserved by hash.
- **Audit:** Immutable artifact trail.
- **Cache correctness:** Hash-based lookup eliminates stale cache bugs.

The DB stores hash pointers, never inline content:

```typescript
// packages/db/src/schema/pages.ts
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => crawlJobs.id),
  canonicalUrl: text('canonical_url').notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  statusCode: integer('status_code'),
  contentType: text('content_type'),
  markdownHash: text('markdown_hash'),        // SHA-256
  rawHtmlHash: text('raw_html_hash'),
  renderedHtmlHash: text('rendered_html_hash'),
  screenshotHash: text('screenshot_hash'),
  videoReceiptHash: text('video_receipt_hash'),
  ariaSnapshotHash: text('aria_snapshot_hash'),
  harHash: text('har_hash'),
  metadataHash: text('metadata_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 9. Implementation Priority Summary

```
0. Security baseline, egress firewall, Docker, DB, artifact store
1. Firecrawl v2.8-compatible scrape/crawl/map wrapper + durable jobs
2. Job model hardening, replay, activity logs, engine attempt tracking
3. Waterfall engine + Playwright worker + video receipts + session vault
4. ModelAdapter/ModelRouter + structured extraction (Kimi K2.6 default)
5. Domain policy + egress controls + robots + rate limiting
6. Agent Lite + search provider + webhooks
7. Dashboard with activity/usage/failures/artifacts/receipts
8. CLI polish + CrawlX SKILL.md for coding agents
9. Change tracking + scheduled recrawls + watch jobs
```

Key correction from v1: **waterfall, policy, and artifact storage come before "fancy agent."** Otherwise the agent just automates unreliable scraping.

---

## 10. Risk Register (Revised)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Firecrawl OSS drops more self-host support | Medium | High | `CrawlEngine` interface allows swapping to Crawl4AI or raw Playwright. Firecrawl is replaceable. |
| Kimi K2.6 cloud pricing/availability changes | Medium | Medium | `ModelRouter` selects from multiple adapters. OpenAI-compat adapter as fallback. |
| AGPL compliance challenge | Low | High | Firecrawl consumed as Docker service, never forked. Documented in `LICENSE-NOTICE.md`. |
| Browser worker resource exhaustion | High | Medium | Docker resource limits, `MAX_CONCURRENT_PAGES`, circuit breaker. |
| SSRF via browser worker | Medium | Critical | Three-layer egress firewall (URL → DNS → network). Implemented in Track 0. |
| External browser session bridge abuse | Medium | Critical | Fixed-origin allowlist only, bridge auth, replay protection, no arbitrary shell execution, lease ownership, audit logs. |
| npm supply chain compromise | Medium | High | `pnpm audit`, image digest pinning, Biome for linting, no `latest` tags. |
| Scope creep into Phase 2 | High | High | "Design seam now, implement later." Stubs return 501. Conductor board enforced. |
| DNS rebinding attack | Low | Critical | DNS guard validates resolved IPs against blocked ranges post-resolution. |
| LLM-generated recipe injection | Medium | High | Recipe sandbox — allowlisted actions only, no `evaluate`, timeout enforcement, human approval for auth targets. |

---

## 11. ChangeGuard Workflow — Per Track

Same as v1:

```
1. changeguard ledger status
2. changeguard hotspots --limit 5
3. changeguard ledger start --entity <target> --category <CAT> --message "Track N: <name>"
4. [TDD implementation]
5. changeguard scan --impact
6. changeguard verify
7. pnpm -r run test
8. changeguard ledger commit --tx-id <id> --summary "<what>" --reason "<why>" --verification-status verified
9. git add . && git commit -m "Track N: <summary>"
10. git push  # Pre-push hook enforces clean ledger
```

---

## 12. Definition of Done — Global

A track is **COMPLETED** when:

1. All listed deliverables exist and function.
2. All listed test categories pass green.
3. `changeguard verify` passes (lint + typecheck + tests).
4. `changeguard ledger commit` recorded.
5. Conductor board updated.
6. No `TODO`/`FIXME` without linked issue.
7. Docs updated.
8. `git push` succeeds (pre-push hook validates).
9. Optional external-session backends, if enabled, have a compatibility matrix, lease model, and threat controls documented.

---

## 13. First Session — Getting Started

```powershell
# 1. Clone and install
git clone <repo>
cd crawlx
corepack enable
pnpm install

# 2. Verify deps
pnpm audit --audit-level high

# 3. Start infrastructure (exact-tagged images)
docker compose up -d postgres redis firecrawl firecrawl-playwright

# 4. Initialize ChangeGuard
changeguard init
changeguard doctor

# 5. Run migrations
pnpm --filter @crawlx/db run migrate

# 6. Verify
changeguard verify

# 7. Start Track 0
changeguard ledger start --entity . --category INFRA --message "Track 0: security baseline + infra"
```

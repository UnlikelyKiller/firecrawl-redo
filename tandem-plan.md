# Tandem Integration Plan for CrawlX

Date: 2026-04-25
Status: **IMPLEMENTED** (Track 10)

## Implementation Status (2026-04-25)

Tandem is integrated as an optional external browser backend in the waterfall engine. The integration uses the real Tandem HTTP REST API, not CDP or profile management.

**What was built:**
- `TandemBrowserEngine` in `packages/waterfall-engine/src/engines/tandem-browser.ts`
- Real API flow: `GET /status` → `POST /tabs/open` → `POST /wait` → `GET /page-content` → `GET /page-html` → `POST /tabs/close`
- Auth: `Authorization: Bearer <token>` (token from `~/.tandem/api-token`)
- Worker integration: `TandemOptions` + `TandemEligibilityResult` in `packages/jobs/src/worker.ts`
- Policy engine supports `tandem_required` browserMode and `tandem` sessionBackend
- Domain policy API exposes `allows_external_browser_backend`, `requires_human_session`, `requires_operator_handoff`

**WSL installation:** Tandem cloned, built from source, and verified running in WSL Ubuntu with Xvfb at `http://127.0.0.1:8765`. End-to-end scrape of `example.com` verified.

**What Tandem does NOT provide (still on CrawlX):** profile-per-identity management, proxy binding, lease enforcement — those remain in `@crawlx/profile-identity` for Multilogin-style workflows.

## Purpose

Evaluate whether CrawlX should support [Tandem Browser](https://github.com/hydro13/tandem-browser) as an optional external browser/session backend instead of, or alongside, the current Multilogin-oriented seam.

This document is intentionally repo-aligned:

- it preserves CrawlX's current policy posture
- it does not assume anti-bot or login-wall bypass as a product goal
- it treats Tandem as an optional backend, not a core dependency
- it distinguishes clearly between browser/session control and browser identity/fingerprint management

## Executive Summary

Tandem is a better fit than Multilogin if the goal is:

- attach CrawlX to a real, local, authenticated browser session
- give agents richer browser-native controls through HTTP or MCP
- support human-in-the-loop workflows in the same browser runtime
- reduce vendor lock-in by using an open-source local-first browser

Tandem is not a true Multilogin replacement if the requirement is:

- dedicated profile-per-identity management
- proxy-bound profile orchestration
- commercial anti-detect browser operations
- a Windows-native, production-proven profile launcher model

Bottom line:

- Tandem is strong as a `shared browser + session + agent tooling` backend
- Tandem is weak as an `identity/fingerprint/proxy management` backend
- CrawlX should adopt Tandem only if the product goal shifts toward authenticated browser collaboration and local session reuse, not toward anti-detect profile management

## What Tandem Appears to Be

Based on Tandem's public README and architecture docs, Tandem is:

- a local-first Electron browser
- a browser with built-in HTTP and MCP control surfaces
- a runtime where agents and humans share the same tabs, sessions, and page state
- a browser that exposes structured accessibility-tree, network, DevTools, and workflow capabilities

Important stated properties from the project docs:

- same tabs, cookies, and logged-in sessions as the human user
- local HTTP API and MCP access
- remote access over Tailscale
- multiple agents connected to the same browser
- accessibility-tree snapshots and `@ref` interaction
- network logging, HAR export, and request mocking
- session partitions and persistent local state in `~/.tandem/`
- an explicit multi-layer security perimeter around agent access

Sources:

- Tandem README: <https://github.com/hydro13/tandem-browser>
- Tandem architecture guide: <https://github.com/hydro13/tandem-browser/blob/main/ARCHITECTURE.md>
- Tandem docs index: <https://github.com/hydro13/tandem-browser/blob/main/docs/INDEX.md>

## Strengths CrawlX Could Get from Tandem

### 1. Richer Agent-Native Browser Control

This is Tandem's biggest advantage over the current Multilogin seam.

Instead of forcing CrawlX to attach through CDP and infer capabilities, Tandem already exposes:

- HTTP API routes for browser, content, network, sessions, snapshots, tabs, workspaces, and media
- MCP tools mirroring those HTTP surfaces
- structured accessibility references for interaction

Potential CrawlX benefits:

- less custom bridge code than a raw CDP-first design
- more stable control surfaces for actions like click, type, scroll, page-read, and tab targeting
- easier integration for Agent Lite and future workflow/recipe systems

### 2. Shared Real Session Reuse

Tandem is explicitly designed around the user's real browser state:

- same tabs
- same cookies
- same logged-in sessions

That is a strong fit for CrawlX use cases where:

- the user is already authenticated
- the user needs a human handoff for MFA or CAPTCHA
- the agent should continue in the same live session after handoff

This can be a better operator experience than launching a separate external browser profile for every job.

### 3. Better Human-in-the-Loop Workflows

Tandem's model is closer to "agent + operator in one browser" than "external browser launched for automation."

Potential CrawlX gains:

- user approves or completes a step in the same browser runtime
- CrawlX resumes using the same tabs and state
- less friction around handoff/replay/debugging
- better ergonomics for Agent Lite, watch jobs, and review flows

### 4. Stronger Structured Read Surfaces

Tandem appears to provide more than raw DOM:

- accessibility tree snapshots
- structured content extraction / markdown
- live network visibility
- DevTools-bridged inspection

Potential CrawlX gains:

- improved extraction context before sending content to `ModelAdapter`
- more reliable replay/debugging when the DOM is dynamic
- better receipts and observability if CrawlX stores page-read outputs, network metadata, and screenshots together

### 5. Open-Source and Local-First

Compared to the Multilogin plan, Tandem gives CrawlX:

- less proprietary coupling
- fewer licensing constraints
- more inspectable runtime behavior
- a cleaner story for self-hosted/local operator workflows

That is a real strategic advantage if the team wants an open, inspectable browser backend rather than a paid external dependency.

### 6. Built-In Security Concepts That Match CrawlX's Direction

Tandem is unusually explicit about agent/browser security:

- local-only HTTP API by default
- bearer-token auth
- separation between browser layers
- prompt-injection defenses
- approval gates for posture-weakening changes

That maps well to CrawlX's existing Track 0 and Track 5 posture:

- egress controls
- policy enforcement
- explicit operator approvals
- fail-closed behavior for sensitive surfaces

### 7. Existing Session, Watch, Workflow, and Network Features

Tandem already documents:

- session partitions
- scheduled page monitoring
- workflow execution
- network inspection
- HAR export
- request mocking

Those could materially reduce custom implementation work if CrawlX chooses to integrate at the API layer instead of rebuilding equivalent primitives.

## What Tandem Does Not Solve Well

### 1. It Is Not a Profile Manager

Tandem does not appear to provide a Multilogin-style model for:

- large numbers of isolated commercial browser identities
- profile-level proxy binding and lifecycle management
- external anti-detect profile orchestration

This is the biggest reason Tandem should not be described as a drop-in replacement.

### 2. Windows Is Not the Primary Platform

Tandem's README currently states:

- primary platform: macOS
- secondary platform: Linux
- Windows: validated as a remote agent host

Tandem's website is more conservative and says:

- macOS is the most complete platform today
- Linux is pre-beta
- Windows is planned but not yet available

That matters because the current Multilogin plan was explicitly designed around a Windows-native operator machine.

If CrawlX pivots to Tandem, the preferred operator environment likely becomes:

- macOS first
- Linux second
- Windows only after explicit validation

Practical implication:

- treat Windows support as uncertain until CrawlX performs direct install, attach, and stability validation
- do not design the first production rollout around Windows-only assumptions

### 3. Identity/Fingerprint Claims Need Independent Validation

Tandem does document stealth and anti-fingerprint work inside the browser runtime, but that is not the same thing as a commercial anti-detect browser platform with mature profile/proxy operations.

CrawlX should assume:

- Tandem may improve automation realism
- Tandem may reduce obvious Electron/automation signals
- Tandem should not be treated as equivalent to Multilogin on operational identity management without direct validation

### 4. CrawlX Would Be Integrating to Another Browser Platform, Not Just CDP

This is a tradeoff:

- CDP attach is generic but lower-level
- Tandem's HTTP/MCP APIs are richer but more product-specific

Using Tandem well would likely mean writing a purpose-built `TandemBrowserEngine`, not just another CDP adapter.

## Recommended Positioning in CrawlX

The clean repo-aligned position is:

`Tandem` is an optional external browser/session backend for authenticated, human-in-the-loop, agent-friendly workflows.

It should not be positioned as:

- a default waterfall engine
- a universal replacement for local Playwright
- a policy escape hatch
- a substitute for CrawlX policy controls

## Recommended Deployment

### Preferred

- Tandem runs on the same operator machine as the logged-in browser
- CrawlX talks to Tandem over a tightly scoped local HTTP surface or MCP bridge
- CrawlX remains the orchestrator, receipt store, policy layer, and job system

### Acceptable

- Tandem runs on a nearby trusted machine
- CrawlX connects over a controlled tunnel such as Tailscale
- all access remains authenticated, auditable, and allowlisted

### Not Recommended Initially

- assuming Windows production parity without direct validation
- exposing Tandem's API broadly on the network
- making Tandem mandatory for all CrawlX jobs

## Proposed Architecture Changes

### Track 0: Security Baseline

Add a new optional external-browser rule set for Tandem:

- allow one configured Tandem control origin only
- do not broadly allow `localhost`, private ranges, or arbitrary hostnames
- require explicit enablement via feature flag
- require bearer token auth for all requests
- log every outbound request to the Tandem control surface

Preferred config shape:

```env
CRAWLX_TANDEM_ENABLED=false
CRAWLX_TANDEM_BASE_URL=http://127.0.0.1:8765
CRAWLX_TANDEM_API_TOKEN=<secret>
CRAWLX_TANDEM_ALLOWED_ORIGIN=http://127.0.0.1:8765
```

Security requirements:

- token stored in secret manager / environment, never DB
- request signing or nonce support if CrawlX adds a local bridge
- explicit audit trail for session attach, tab selection, and agent actions

### Track 3: Waterfall Engine

Do not treat Tandem as a silent replacement for `multilogin-cdp.ts`.

Instead add a dedicated engine:

- `packages/waterfall-engine/src/engines/tandem-browser.ts`

Recommended responsibility:

- attach to an existing Tandem browser session through HTTP or MCP
- open or target a tab/session
- request structured page extraction
- execute approved interaction sequences
- collect receipts compatible with CrawlX artifacts where feasible

Suggested waterfall placement:

- optional branch after local browser-backed engines
- only eligible when policy permits `session_backend=tandem`
- not part of the default public-web path

### Track 3: Capability Matrix

Before calling Tandem production-ready, validate:

| Capability | Tandem surface | Expected support | Notes |
| --- | --- | --- | --- |
| Navigate | HTTP/MCP browser tools | High | Core stated feature |
| Click/type/scroll | HTTP/MCP snapshot/browser tools | High | Structured + trusted input model |
| Structured page read | Content/snapshot APIs | High | One of Tandem's strongest seams |
| Screenshot | Media/browser APIs | High | Stated feature |
| Accessibility snapshot | Snapshot manager | High | Native strength |
| HAR export | Network API | Medium/High | Stated feature, validate artifact mapping |
| Video receipt | Media/video APIs | Medium | Validate per-job artifact flow |
| Tab targeting | HTTP headers/session targeting | High | Strong fit for CrawlX replay/review |
| Session isolation | Tandem session partitions | Medium/High | Validate mapping to CrawlX job model |
| Replay determinism | Workflow + snapshot refs | Medium | Must test carefully |

### Track 3: Session Backend

Reuse the existing external-session backend seam, but change the backend model:

- `backend_type = tandem`
- store Tandem session identifiers, partition names, or workspace references
- optionally store tab-selection hints
- do not model this as a profile-manager backend

Suggested DB additions:

- `browser_profiles.backend_type` already or additionally supports `tandem`
- `browser_profiles.external_profile_id` becomes generic enough to hold Tandem session/workspace identity
- optional `external_session_hint`
- optional `external_tab_hint`

### Track 4: ModelAdapter / Extraction

Tandem's read surfaces may reduce the need to pass raw DOM into CrawlX extraction.

Recommended flow:

1. CrawlX asks Tandem for the best available structured content:
   - markdown
   - accessibility snapshot
   - selected network metadata
2. CrawlX normalizes that into existing extraction inputs
3. `ModelAdapter` still performs schema validation, routing, and provider control

This keeps CrawlX's value centered on:

- extraction orchestration
- schema enforcement
- policy
- receipts
- job durability

while letting Tandem provide a better browser-native read layer.

### Track 5: Policy Engine

Do not weaken current domain restrictions just because Tandem exists.

Recommended policy additions:

- `session_backend: 'local' | 'multilogin' | 'tandem'`
- `requires_human_session: boolean`
- `allows_external_browser_backend: boolean`
- `requires_operator_handoff: boolean`

Recommended semantics:

- blocked domains remain blocked unless product policy explicitly changes
- Tandem eligibility is domain/policy gated
- Tandem is mainly for authenticated or operator-assisted workflows, not broad crawl traffic

### Track 6: Agent Lite

This is where Tandem is likely strongest.

Agent Lite benefits:

- can continue inside a real logged-in browser
- can ask for human handoff in-place
- can consume structured page data without brittle site-specific scripts
- can operate across tabs/workspaces with explicit locks and ownership

If CrawlX wants an agent-first browser backend, Tandem is a more natural fit than Multilogin.

## Integration Models

### Option A: HTTP-Native Integration

CrawlX calls Tandem's local HTTP API directly.

Pros:

- simplest architecture
- no CDP translation layer
- richest documented surface

Cons:

- tighter coupling to Tandem's API model
- requires explicit feature mapping into CrawlX receipts/job semantics

### Option B: MCP Bridge Integration

CrawlX talks to a small local bridge that translates internal CrawlX actions into Tandem MCP calls.

Pros:

- aligns well with agent-oriented workflows
- could share code with Agent Lite or future tool adapters

Cons:

- more moving parts
- less direct than HTTP

### Option C: Hybrid

Use HTTP for deterministic browser operations and MCP for richer agent-assisted tasks.

This is likely the best long-term design if Tandem becomes a serious CrawlX backend.

## Reliability Requirements

Even though Tandem is local-first, CrawlX still needs production discipline:

- explicit session ownership / lease model
- idle timeout and cleanup
- crash-safe reconnect semantics
- job-level tab/session pinning
- fail-closed behavior when the Tandem API is unavailable
- explicit capability detection on startup
- version pinning and compatibility checks

Recommended additional controls:

- `GET /health` or equivalent preflight before job routing
- version compatibility probe at worker boot
- receipt capability flags per job attempt
- structured error taxonomy:
  - `TANDEM_NOT_CONFIGURED`
  - `TANDEM_UNAVAILABLE`
  - `TANDEM_AUTH_FAILED`
  - `TANDEM_CAPABILITY_UNSUPPORTED`
  - `TANDEM_SESSION_NOT_FOUND`

## Testing Strategy

Minimum validation before enabling Tandem in real flows:

1. Unit tests
   - config validation
   - policy gating
   - engine capability mapping
   - error taxonomy
2. Integration tests
   - mocked Tandem HTTP API
   - session attach / tab target
   - structured extraction
   - screenshot / HAR / artifact mapping
3. End-to-end tests
   - local authenticated session reuse
   - human handoff and resume
   - watch job / replay flow
   - clean DB migration and rollback validation
4. Platform validation
   - macOS first
   - Linux second
   - Windows only after explicit smoke and stability testing

## Risks

- Tandem API shape may change quickly because the project is still in public developer preview
- Windows support may lag the team's current operator environment
- Tandem's public documentation is somewhat inconsistent on Windows readiness, so platform assumptions need direct validation
- integrating directly to Tandem's API may create a tighter product dependency than a generic browser worker
- Tandem's stealth layer may help realism but should not be marketed internally as equivalent to commercial anti-detect tooling

## Recommended Plan Deltas

If CrawlX pivots from Multilogin-first to Tandem-first, the plan deltas should be:

1. Replace `apps/multilogin-bridge/` as the primary external-browser initiative with a new `apps/tandem-adapter/` or direct API integration design.
2. Add `tandem-browser.ts` as the preferred external browser engine for authenticated session reuse.
3. Keep `multilogin-cdp.ts` optional and secondary, not default.
4. Reframe the external browser seam from `anti-detect profile backend` to `authenticated external browser backend`.
5. Keep policy restrictions unchanged unless separately approved.
6. Prefer macOS/Linux operator validation first if Tandem becomes the chosen path.

## Recommended Decision

Choose Tandem if the real goal is:

- authentic browser/session reuse
- agent-native browser control
- human + AI collaboration in one runtime
- local-first open-source integration

Do not choose Tandem if the real goal is:

- industrialized profile management
- proxy-bound browser identities
- Windows-native anti-detect operations
- commercial browser-identity workflows

## Bottom Line

Tandem gives CrawlX a different class of advantage than Multilogin.

Multilogin is strongest where browser identity management is the main problem.
Tandem is strongest where browser control, session reuse, structured read surfaces, and human-in-the-loop workflows are the main problem.

For CrawlX specifically, Tandem looks more compelling than Multilogin if the team wants:

- an open-source backend
- a better Agent Lite browser partner
- less custom bridge work
- a stronger local authenticated-browser story

It looks less compelling if the team still needs a true anti-detect/profile-management platform.

# Tandem + Profile Identity Implementation Plan for CrawlX

Date: 2026-04-25
Status: **IMPLEMENTED** (Track 3a + Track 10)
Owner: Ryan / CrawlX

## Completion Notes (2026-04-25)

The core integration described in this plan is implemented. Key correction from the original plan:

**Tandem does not use CDP, profiles, or leases.** The original plan assumed Tandem would be used via CDP session attach/heartbeat/release (similar to Multilogin). Tandem is actually a local HTTP REST API browser — you open tabs, read content, close tabs. No profile management, no lease lifecycle.

The profile-identity layer (`@crawlx/profile-identity`) with `ProfileIdentityService` and `OrphanReconciler` applies to Multilogin-style workflows where named profiles need acquisition/release. For Tandem, the browser session is the user's own browser and no CrawlX-side lease is required.

## Purpose

Define a concrete implementation plan for adding Tandem as an optional external browser backend in CrawlX while also adding the missing profile-bound identity layer that Tandem does not provide natively.

This plan is designed to fit the existing CrawlX architecture rather than replace it.

It assumes:

- CrawlX remains the orchestrator, job system, policy engine, receipt store, and extraction layer
- Tandem is used as an optional browser/session runtime
- profile-bound proxy and identity control are implemented in CrawlX's own control plane
- the project does not weaken existing policy or safety posture

## Why This Plan Exists

The current Tandem proposal is strong on browser control, session reuse, and agent ergonomics, but incomplete on:

- profile-bound proxy ownership
- stable identity/session isolation
- session lease enforcement
- policy mapping for external browser usage
- rollout validation across platforms
- production recovery, auditability, and observability

This plan fills those gaps.

## Design Thesis

Treat the system as three separate layers:

1. `Profile Identity Layer`
   Owns account-to-profile binding, proxy ownership, locale/timezone consistency, session storage roots, and lease control.

2. `Browser Runtime Layer`
   Executes browsing inside one of:
   - local Playwright/browser-worker
   - Tandem
   - optional future external backend

3. `CrawlX Control Plane`
   Chooses the backend, applies policy, records attempts/artifacts, manages job durability, and fails closed on mismatches.

This separation is the key to making Tandem usable without pretending it is a profile manager.

## Non-Goals

- building a commercial anti-detect browser platform clone
- weakening domain policy just because a richer browser backend exists
- broad public-network exposure of Tandem APIs
- using Tandem as the default path for ordinary public-web jobs
- claiming Windows production readiness before direct validation

## Target Outcome

When complete, CrawlX should be able to:

- route selected jobs to Tandem when policy allows it
- attach those jobs to a stable CrawlX-managed profile identity
- enforce one active lease per profile
- keep proxy/locale/session ownership stable for the life of the job
- support human-in-the-loop resume on the same live session
- store receipts compatible with existing CrawlX job pages
- survive restarts without orphaning ownership state
- validate the full flow with clean migrations and end-to-end tests

## High-Level Architecture

### Profile Identity Layer

New or extended responsibilities:

- profile registry
- proxy registry
- session storage root metadata
- account/profile binding
- lease ownership and heartbeats
- cooldown and quarantine state
- backend compatibility flags

### Tandem Backend Layer

New component:

- `TandemBrowserEngine`

Possible support component:

- `apps/tandem-adapter/` only if direct HTTP integration proves too awkward

Preferred design:

- use Tandem's local HTTP API directly first
- add MCP translation only if needed for agent-centric flows
- avoid CDP-first integration unless a specific feature is unavailable otherwise

### CrawlX Control Plane

Existing packages extended:

- `packages/db`
- `packages/policy`
- `packages/security`
- `packages/waterfall-engine`
- `packages/core`
- `apps/api`
- `apps/browser-worker` or a Tandem-focused worker seam
- `apps/web`
- `apps/cli`

## New Core Concepts

### 1. Profile Identity

A profile identity is a stable unit that binds:

- one logical account or tenant
- one storage root / session partition
- zero or one fixed proxy assignment
- one locale/timezone bundle
- one browser backend compatibility policy

This is not just "a browser profile directory."

It is the policy and ownership object for external authenticated browsing.

### 2. Lease

A lease is the concurrency and safety primitive for profile use.

Each active external session must have:

- one `profile_id`
- one `job_id`
- one `owner`
- one `lease_token`
- one `expires_at`
- one `last_heartbeat_at`

Rules:

- one active lease per profile
- no backend attach without lease ownership
- heartbeat required for long-running sessions
- expired leases trigger cleanup and quarantine logic

### 3. Backend Eligibility

Backend selection must consider:

- domain policy
- profile backend compatibility
- profile health
- proxy readiness
- Tandem health/version
- operator approval requirements

Tandem should only be considered when all of those pass.

## Data Model

### `browser_profiles`

Add or extend fields:

- `id`
- `name`
- `backend_type`
  - `local`
  - `tandem`
  - `multilogin`
  - `custom`
- `external_profile_id`
- `storage_path`
- `session_partition`
- `default_tab_hint`
- `account_label`
- `tenant_id`
- `proxy_id`
- `timezone`
- `locale`
- `user_agent_family`
- `browser_channel`
- `status`
  - `active`
  - `disabled`
  - `quarantined`
  - `cooldown`
- `capabilities_json`
- `last_healthcheck_at`
- `last_used_at`
- `created_at`
- `updated_at`

### `proxies`

Add a dedicated proxy registry:

- `id`
- `name`
- `provider`
- `proxy_url`
- `auth_secret_ref`
- `geo_country`
- `geo_region`
- `timezone_hint`
- `status`
- `last_healthcheck_at`
- `created_at`
- `updated_at`

### `browser_profile_leases`

Add or harden fields:

- `id`
- `profile_id`
- `job_id`
- `owner_type`
  - `worker`
  - `agent`
  - `operator`
- `owner_id`
- `lease_token`
- `status`
  - `active`
  - `expired`
  - `released`
  - `orphaned`
- `started_at`
- `expires_at`
- `last_heartbeat_at`
- `released_at`
- `release_reason`

### `profile_events`

Add an event log table:

- `id`
- `profile_id`
- `job_id`
- `event_type`
  - `lease_acquired`
  - `lease_heartbeat`
  - `lease_released`
  - `quarantined`
  - `backend_attach_started`
  - `backend_attach_failed`
  - `proxy_mismatch`
  - `operator_handoff`
  - `operator_resume`
- `meta_json`
- `created_at`

### `domain_policies`

Add or standardize fields:

- `allows_external_browser_backend`
- `requires_human_session`
- `requires_operator_handoff`
- `session_backend`
- `named_profile_only`
- `profile_name`
- `proxy_required`

## Security Model

### Track 0 Requirements

The Tandem integration must preserve CrawlX's current firewall posture.

Rules:

- allow exactly one configured Tandem origin
- deny arbitrary localhost/private-range egress
- require explicit feature flag enablement
- require token auth for every request
- fail closed on DNS drift or mismatched origin

Recommended env:

```env
CRAWLX_TANDEM_ENABLED=false
CRAWLX_TANDEM_BASE_URL=http://127.0.0.1:8765
CRAWLX_TANDEM_ALLOWED_ORIGIN=http://127.0.0.1:8765
CRAWLX_TANDEM_API_TOKEN=<secret>
CRAWLX_TANDEM_REQUIRE_CAPABILITIES=browser,content,snapshots,sessions
```

Additional controls:

- redact Tandem token from logs and artifacts
- record all outbound Tandem calls in activity logs
- require exact-origin match after DNS resolution
- add version/capability probe at startup

### Identity Integrity Controls

Never permit:

- proxy rotation during an active lease
- attaching a job to a profile owned by a different tenant
- backend attach without a valid lease token
- silent fallback from `tandem` to another backend when the policy explicitly requires Tandem

Must enforce:

- profile-to-proxy stability
- locale/timezone consistency
- explicit operator approval for handoff-required jobs
- quarantine on repeated mismatch or attach failure

## Tandem Backend Design

### Engine

Add:

- `packages/waterfall-engine/src/engines/tandem-browser.ts`

Responsibilities:

- resolve eligible profile identity
- acquire lease
- probe Tandem health and capabilities
- attach to the intended session/tab/workspace
- execute approved interactions
- capture structured page outputs and artifacts
- heartbeat the lease while active
- release or quarantine on completion/failure

### Capabilities to Map

Minimum capability matrix:

| Capability | Required at launch | Notes |
| --- | --- | --- |
| health/version probe | Yes | hard prerequisite |
| session enumeration | Yes | needed for attach semantics |
| tab targeting | Yes | required for durable replay/handoff |
| page navigation | Yes | core |
| structured page read | Yes | key Tandem strength |
| screenshot | Yes | artifact minimum |
| accessibility snapshot | Yes | artifact and operator-debug value |
| network/HAR export | Nice-to-have | validate receipt mapping |
| video receipt | Nice-to-have | validate before claiming parity |
| workflow execution | Nice-to-have | phase after stable attach |

### Attach Semantics

Define one attach contract:

1. validate job policy
2. resolve profile
3. acquire lease
4. validate proxy/profile compatibility
5. check Tandem health/version
6. attach to session/workspace/tab
7. record attach event
8. run interactions/extraction
9. write artifacts
10. release or quarantine

### Failure Taxonomy

Add structured errors:

- `TANDEM_NOT_CONFIGURED`
- `TANDEM_UNAVAILABLE`
- `TANDEM_AUTH_FAILED`
- `TANDEM_CAPABILITY_UNSUPPORTED`
- `TANDEM_PROFILE_NOT_FOUND`
- `TANDEM_SESSION_NOT_FOUND`
- `TANDEM_LEASE_CONFLICT`
- `TANDEM_PROXY_MISMATCH`
- `TANDEM_POLICY_DENIED`

## Profile Identity Service

Add a dedicated service seam, likely in:

- `packages/core` for types
- `packages/policy` or a new `packages/profile-identity`

Core operations:

- `resolveProfileForJob`
- `acquireLease`
- `heartbeatLease`
- `releaseLease`
- `quarantineProfile`
- `validateProxyBinding`
- `validateBackendCompatibility`

This should not live ad hoc inside the Tandem engine.

## Track-by-Track Work Plan

### Track A: Architecture and ADR

Deliverables:

- ADR for Tandem as optional external browser backend
- ADR for profile identity layer
- threat-model update
- operator runbook

Acceptance:

- docs explicitly separate identity layer from browser layer
- Windows uncertainty documented
- policy posture unchanged

### Track B: Schema and Migrations

Deliverables:

- add or extend `browser_profiles`
- add `proxies`
- add or extend `browser_profile_leases`
- add `profile_events`
- migration tests against clean DB

Acceptance:

- migration applies cleanly on empty DB
- migration applies cleanly on populated dev DB
- rollback or forward-fix path documented

### Track C: Profile Identity Service

Deliverables:

- profile resolution logic
- lease management with TTL/heartbeat
- quarantine/cooldown support
- proxy compatibility validator

Acceptance:

- one active lease per profile enforced
- expired lease recovery tested
- cross-tenant attach denied

### Track D: Security and Config

Deliverables:

- Tandem origin allowlist support in security package
- token redaction
- DNS/origin verification
- startup capability probe

Acceptance:

- only configured Tandem origin is permitted
- invalid token or origin fails closed
- activity log captures outbound control calls

### Track E: Tandem Engine

Deliverables:

- `tandem-browser.ts`
- capability mapper
- attach flow
- artifact mapping
- heartbeat during long actions

Acceptance:

- engine only runs when policy allows
- artifacts appear in job detail pages
- attach/release path is idempotent

### Track F: API and Policy Plumbing

Deliverables:

- policy API fields for Tandem/profile identity
- job submission fields for named profiles and operator handoff
- admin/profile/proxy endpoints if needed

Acceptance:

- policy round-trip works through API and UI
- bad profile references fail with structured errors

### Track G: Dashboard and CLI

Deliverables:

- profile registry views
- lease status views
- job detail integration for external backend metadata
- CLI commands for profile health and lease inspection

Acceptance:

- operators can see which profile a job used
- operators can identify stuck/orphaned leases

### Track H: Human-in-the-Loop Flow

Deliverables:

- operator handoff state model
- pause/resume flow against same session/tab
- activity and receipt markers for handoff events

Acceptance:

- operator can resume same job without losing session ownership
- handoff events visible in audit trail

### Track I: Resilience and Recovery

Deliverables:

- restart recovery for active leases
- orphan detection job
- cleanup worker
- quarantine automation after repeated attach failures

Acceptance:

- bridge/worker restart does not leak ownership indefinitely
- orphaned state gets reconciled automatically

### Track J: Validation and Rollout

Deliverables:

- unit tests
- mocked Tandem API integration tests
- end-to-end session reuse tests
- clean migration tests
- changeguard verification additions

Acceptance:

- feature remains disabled by default
- rollout checklist complete
- documented platform support matrix exists

## Missing Gaps This Plan Also Closes

These are the gaps most likely to be missed if Tandem is implemented too narrowly:

### 1. Ownership and Restart Recovery

If lease state only lives in memory, the system is not production-safe.

This plan requires:

- DB-backed lease truth
- heartbeat
- orphan reconciliation
- explicit cleanup paths

### 2. Proxy Registry and Health

A profile-bound identity system is incomplete without a first-class proxy registry.

This plan requires:

- proxy records
- secret references
- health metadata
- consistency validation

### 3. Auditability

Authenticated external browsing is high-risk operationally.

This plan requires:

- profile event log
- activity events for control-plane calls
- attach/release audit trail
- operator handoff/resume events

### 4. Capability Honesty

Do not assume Tandem gives automatic parity with every Playwright receipt.

This plan requires:

- explicit capability matrix
- feature gating
- no parity claims without test coverage

### 5. Platform Reality

The project cannot assume Windows-first stability just because that was true for the Multilogin path.

This plan requires:

- platform support matrix
- macOS/Linux-first validation if Tandem is primary
- Windows marked experimental until proven otherwise

## Rollout Strategy

### Phase 1

- schema
- profile identity service
- security/config
- mocked Tandem integration

### Phase 2

- real Tandem engine
- operator profile selection
- basic artifact mapping

### Phase 3

- human handoff/resume
- restart recovery
- dashboard/CLI visibility

### Phase 4

- capability expansion
- performance tuning
- broader platform validation

## Testing Strategy

### Unit

- policy gating
- profile resolution
- lease lifecycle
- proxy/profile validation
- structured error mapping

### Integration

- mocked Tandem API
- attach flow
- tab/session targeting
- screenshot/a11y artifact capture
- lease heartbeat/release

### Database

- migration on clean DB
- migration on existing DB
- uniqueness and foreign-key behavior
- orphan cleanup queries

### End-to-End

- authenticated session reuse
- named profile submission
- operator handoff/resume
- failed attach with quarantine
- restart recovery

### Verification

Add to ChangeGuard:

- DB migration smoke
- profile identity tests
- Tandem engine tests
- API type/build checks
- dashboard typecheck

## Definition of Done

This work is done only when all of the following are true:

- Tandem integration is disabled by default and policy-gated
- a job can resolve an approved profile identity and acquire a lease
- the lease is heartbeated and released correctly
- proxy/profile mismatches fail closed
- Tandem attach and extraction are tested through mocked integration
- clean DB migration tests exist
- dashboard and CLI expose enough state for operators to debug problems
- restart recovery is implemented
- receipts and activity logs show external browser usage clearly
- ChangeGuard includes the new validation surface

## Recommended Repo Deltas

Likely file/module additions:

- `docs/adr/0002-tandem-external-browser-backend.md`
- `docs/adr/0003-profile-identity-layer.md`
- `packages/db/src/schema/proxies.ts`
- `packages/db/src/schema/profile-events.ts`
- `packages/waterfall-engine/src/engines/tandem-browser.ts`
- `packages/profile-identity/`
- `apps/api/src/routes/crawlx/v2/profiles.ts`
- `apps/web/src/pages/ProfilesPage.tsx`
- `apps/cli/src/commands/profiles.ts`

Likely file/module changes:

- `Implementation-Plan.md`
- `packages/security/src/url-validator.ts`
- `packages/security/src/egress-policy.ts`
- `packages/policy`
- `apps/api`
- `apps/web`
- `apps/browser-worker`

## Bottom Line

The right Tandem integration for CrawlX is not "swap Multilogin for Tandem."

The right design is:

- Tandem for shared browser/session control
- CrawlX for policy/orchestration/receipts
- a dedicated profile identity layer for proxy-bound ownership and stability

If implemented that way, Tandem becomes a strong external browser backend for authenticated, human-in-the-loop, agent-friendly workflows without forcing CrawlX to depend on a proprietary profile manager or pretend Tandem solves identity management by itself.

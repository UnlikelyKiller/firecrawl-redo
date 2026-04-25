# ADR 0001: Multilogin as an Optional External Browser Session Backend

Date: 2026-04-24
Status: Proposed

## Context

CrawlX already defines a local browser-worker, a waterfall engine, a session-vault seam, and a strict egress firewall. Some allowed targets may require an externally managed browser identity that preserves native host fingerprints and persistent authenticated state beyond what the default local browser-worker is designed to provide.

Multilogin is a candidate backend for this need.

This ADR does not change CrawlX's default blocked-domain posture. It only defines how an external browser-session backend can fit into the architecture for explicitly permitted targets.

## Decision

CrawlX will treat Multilogin as an optional external browser-session backend, not as a replacement for the existing browser-worker architecture.

The integration model is:

1. Multilogin official API is the preferred control plane for profile lifecycle.
2. CrawlX attaches to launched browser sessions through a `MultiloginCdpEngine`.
3. A small Windows-native bridge is allowed only when needed to safely proxy host-local CDP access into Docker or to mediate lifecycle in deployments where direct control-plane flow is not viable.
4. All Multilogin use remains policy-gated, disabled by default, and limited to explicitly allowed domains and profiles.

## Consequences

### Positive

- Preserves CrawlX's current local-first architecture while adding a clean external-session seam
- Avoids coupling CrawlX to arbitrary shell orchestration by default
- Keeps the session-vault abstraction relevant by generalizing it into a multi-backend session provider
- Supports higher-friction authenticated workflows without redefining the project as a generic anti-detect scraping platform

### Negative

- Adds operational complexity across Windows host services and Dockerized CrawlX workers
- Introduces a higher-risk trust boundary around host access and automation tokens
- Depends on CDP attachment, which has lower fidelity than a native Playwright protocol connection
- Requires compatibility testing per version set rather than assuming feature parity

## Constraints

- Multilogin use must not weaken blocked-domain defaults
- Multilogin use must not implicitly approve login-wall or CAPTCHA bypass workflows
- Raw host CDP access must not be broadly allowlisted
- Automation tokens must be stored in secret-backed config, never inline in DB records
- One profile must not be leased to multiple jobs unless explicitly marked shareable

## Required Controls

1. Disabled-by-default feature flags.
2. Fixed-origin egress exception for bridge access only.
3. Lease-based ownership of external browser sessions.
4. Capability matrix for CDP-backed features such as HAR, video, tracing, and ARIA snapshots.
5. Structured audit logs for attach/release/start/stop operations.
6. Crash recovery via lease TTL and orphan cleanup.

## Alternatives Considered

### 1. Replace CrawlX branded-browser mode with Multilogin

Rejected.

This would make Multilogin a primary runtime dependency and overfit the architecture to one vendor-specific browser backend.

### 2. Run Multilogin inside Docker/WSL2

Rejected for the primary deployment path.

This undermines the native OS/GPU/font/rendering benefits that motivate the integration.

### 3. Expose raw CDP ports directly to CrawlX

Rejected as the preferred design.

It widens the egress exception and increases the attack surface compared with a fixed authenticated bridge origin.

## Follow-Up Work

1. Update `Implementation-Plan.md` with optional Multilogin deltas.
2. Extend the threat model for bridge auth, host access, and token handling.
3. Add `MultiloginCdpEngine` scaffolding.
4. Add security configuration points for a fixed bridge-origin exception.
5. Add a bridge/API contract spec and a lease model for external session ownership.

# Multilogin Integration Plan for CrawlX

Date: 2026-04-24
Status: Proposal
Owner: TBD

## Purpose

This document proposes an optional Multilogin integration for CrawlX.

The goal is not to replace CrawlX's existing browser-worker architecture. The goal is to add an external browser-session backend that CrawlX can use through a new engine seam when a job explicitly requires an externally managed browser identity.

This proposal should be treated as an architecture extension, not as a correction to the current `Implementation-Plan.md`.

## Core Model

- Multilogin = external browser identity/session provider
- CrawlX = orchestration, policy, extraction, artifact capture, and model-facing normalization

Control/data plane split:

- Control plane: Multilogin official API for profile lifecycle and metadata
- Data plane: CDP attachment to the launched browser session
- Optional local bridge: only for safely proxying host-local CDP access into Docker when direct access is not acceptable or not reachable

In this model, Multilogin does not replace:
- CrawlX waterfall orchestration
- CrawlX policy enforcement
- CrawlX structured extraction
- CrawlX artifact and receipt handling

It adds:
- An optional CDP-backed engine
- An optional external session-provider backend
- A host bridge for Windows-native CDP proxying and, only if required, local lifecycle mediation

## Non-Goals

- Do not redefine blocked-domain policy by default
- Do not treat social-media scraping as an approved target class
- Do not weaken SSRF/egress controls globally
- Do not assume Multilogin is the only authenticated-session backend

## Recommended Deployment

Recommended topology:

1. Multilogin runs natively on Windows 11.
2. CrawlX runs in Docker Desktop / WSL2 as already planned.
3. CrawlX uses Multilogin's official API for profile start/stop and metadata.
4. If the returned automation/CDP endpoint is only reachable on the Windows host, a small Windows-native bridge process exposes a minimal authenticated proxy for CDP access.
5. CrawlX connects to the bridge through `host.docker.internal`.

Rationale:

- Anti-detect browsers depend on native OS, GPU, fonts, and rendering characteristics.
- Running Multilogin inside a Linux container would likely undermine the very browser fingerprint characteristics it is meant to preserve.
- CrawlX already assumes containerized services and benefits from staying isolated from direct host-shell orchestration.
- Multilogin's official automation documentation already supports API-driven profile start/stop and Playwright automation, so custom shell lifecycle management should be the fallback, not the default.

## Compatibility Constraints

Current known constraints from official docs:

- Playwright automation is supported for Mimic profiles
- Playwright automation is not currently supported for Stealthfox profiles
- `connectOverCDP()` works only for Chromium-based browsers
- `connectOverCDP()` is lower fidelity than a native Playwright protocol connection

Implication:

- `MultiloginCdpEngine` should be treated as a compatibility-tested engine with explicit feature gates, not as a generic drop-in browser backend.

## Proposed Architecture Changes

### Track 0: Egress Firewall

Current plan behavior:
- Blocks `127.0.0.1`, `localhost`, private IPs, and `host.docker.internal` by default

Required change:
- Add a narrowly scoped allowlist for the Windows bridge endpoint
- Do not broadly allow `host.docker.internal`
- Prefer a single bridge origin over exposing raw host CDP ports into CrawlX
- If direct CDP ports must be exposed, allow only configured host/port pairs for the minimum tested range

Design rule:
- This exception must be explicit, environment-driven, and disabled by default

Suggested env vars:

```bash
MULTILOGIN_ENABLED=false
MULTILOGIN_BRIDGE_HOST=host.docker.internal
MULTILOGIN_BRIDGE_PORT=4000
MULTILOGIN_DIRECT_CDP_ENABLED=false
MULTILOGIN_CDP_ALLOWED_PORTS=
```

### Track 3: Waterfall Engine

Add a new optional engine:

- `MultiloginCdpEngine`

Recommended placement:

```text
Firecrawl Static
-> Firecrawl JS
-> Firecrawl Playwright
-> CrawlX Playwright
-> CrawlX Branded Browser
-> Multilogin CDP
-> CrawlX Recipe
-> Manual Review
-> Firecrawl Cloud
```

Notes:

- `MultiloginCdpEngine` should not replace `CrawlxBrandedBrowserEngine` by default
- It should be activated only when policy and job configuration permit it
- It should reuse as much of the existing browser-worker receipt/artifact pipeline as compatibility testing proves reliable
- It should degrade gracefully when CDP-attached features are unavailable

Responsibilities of `MultiloginCdpEngine`:

- Request a profile session via Multilogin control-plane API
- Fall back to bridge-mediated lifecycle only if direct control-plane flow is not viable in the deployment
- Receive CDP connection info directly or through the bridge
- Attach via Playwright `connectOverCDP`
- Run approved browser actions through existing CrawlX worker logic
- Capture receipts/artifacts only for features proven to work in CDP mode
- Return structured capability flags when some receipt features are unavailable

### Track 3: Capability Matrix

Before promoting `MultiloginCdpEngine` to general availability, verify and record support for:

- page navigation
- cookies/session continuity
- screenshots
- DOM extraction
- ARIA snapshots
- HAR capture
- video capture
- tracing
- recipe execution
- concurrent sessions

Recommended initial release rule:

- Only mark features as supported after repeatable automated tests pass against the pinned Multilogin + Mimic + Playwright version set.

### Track 3: Session Backend

Do not delete the session-vault seam.

Instead, generalize it:

- existing session vault remains the abstraction
- add an external-profile backend for Multilogin

Recommended DB evolution:

- Keep `browser_profiles` or equivalent session records
- Add a `browser_profile_leases` table or equivalent lease model
- Add fields such as:
  - `backend`: `local_vault | multilogin`
  - `external_profile_id`
  - `external_profile_label`
  - `bridge_target`
  - `automation_type`
  - `profile_kind`

Recommended lease fields:

- `lease_id`
- `profile_id`
- `owner_job_id`
- `worker_id`
- `expires_at`
- `last_heartbeat_at`
- `status`
- `cooldown_until`
- `last_error`

Reason:

- CrawlX still needs a first-class session model even if the browser state is managed outside CrawlX
- Multilogin should be one backend, not the only backend
- Leases prevent two jobs from attaching to the same browser identity at once
- Lease expiry and cleanup make crash recovery predictable

### Track 4: ModelAdapter / Extraction

Multilogin does not materially change the `ModelAdapter` abstraction.

It does improve the quality of rendered/authenticated page state that reaches extraction.

Recommended update:

- Add extraction hints rather than hardcoding a new default model decision around Multilogin

Examples:

- `requires_large_context`
- `authenticated_dom`
- `heavy_client_rendering`

This keeps model routing capability-based instead of vendor-coupled.

### Track 5: Policy Engine

This is the most important governance point.

Current plan:
- Blocks social media by default
- Advises against login-wall/CAPTCHA bypass workflows

Recommended change:

- Do not replace hard blocks with automatic `require_engine: multilogin`
- Instead add a new policy concept for optional engine requirements on domains that are already permitted

Example fields:

```ts
type BrowserModePolicy =
  | "standard"
  | "branded"
  | "multilogin_required";
```

and/or:

```ts
type SessionBackendPolicy =
  | "crawlx_local"
  | "multilogin";
```

Use cases:

- authenticated internal partner portal that your organization is allowed to access
- high-friction commercial site where use is contractually authorized

Not implied:

- default approval for social-media scraping
- default approval for login-wall bypass

Additional policy controls worth adding:

- `requires_manual_approval`
- `requires_named_profile`
- `allowed_session_backends`
- `max_profile_session_minutes`
- `allow_persistent_login_state`

## Windows Bridge

Add a new host-native component:

- `apps/multilogin-bridge/`

This should not be Dockerized in the first version.

Responsibilities:

- Validate requested profile IDs against an allowlist
- Optionally proxy CDP traffic from a single fixed origin
- Return CDP port / websocket target when policy permits
- Support stop/status only if direct Multilogin lifecycle control is delegated to the bridge
- Expose health/status
- Authenticate requests from CrawlX
- Bind only to a controlled local/private interface
- Enforce lease ownership from CrawlX
- Refuse arbitrary command execution

Preferred design:

- The bridge does not run arbitrary shell commands from request parameters
- The bridge does not accept arbitrary target hosts or ports
- The bridge does not become a generic localhost TCP forwarder

Preferred endpoints:

- `POST /session/attach`
- `POST /session/release`
- `GET /session/:leaseId/status`
- `GET /health`

Fallback endpoints only if lifecycle must be locally mediated:

- `POST /profile/start`
- `POST /profile/stop`
- `GET /profiles/:id/status`

Suggested response shape:

```json
{
  "profileId": "abc-123",
  "leaseId": "lease-123",
  "cdpUrl": "http://host.docker.internal:9222",
  "wsEndpoint": "ws://host.docker.internal:9222/devtools/browser/...",
  "startedAt": "2026-04-24T12:00:00.000Z",
  "expiresAt": "2026-04-24T12:15:00.000Z",
  "capabilities": {
    "screenshots": true,
    "ariaSnapshots": true,
    "har": false,
    "video": false,
    "tracing": false
  }
}
```

Security requirements:

- shared secret or mTLS between CrawlX and bridge
- per-profile allowlist
- no arbitrary shell execution from API input
- no open LAN exposure by default
- request signing and replay protection
- rate limiting
- structured audit log for every attach/release operation

## Authentication and Secrets

Use Multilogin automation tokens, not interactive account credentials, in production automation flows.

Rules:

- store Multilogin tokens in environment-backed secrets, not in the CrawlX database
- rotate tokens on a defined schedule
- separate bridge authentication from Multilogin authentication
- redact all tokens from logs, traces, receipts, and error messages
- track token usage in audit logs without storing token values

## Proxy Ownership

Recommended rule:

- Multilogin owns proxy configuration for Multilogin-backed jobs
- CrawlX owns proxy configuration for native CrawlX browser engines

Why:

- fingerprint/proxy/timezone/WebRTC consistency is part of the Multilogin profile model
- letting CrawlX mutate proxy state inside a Multilogin-run profile would undermine that consistency

Additional resilience rule:

- if a job requires a different proxy than the assigned Multilogin profile, fail policy validation instead of mutating the profile at runtime

## Proposed Config Additions

```bash
MULTILOGIN_ENABLED=false
MULTILOGIN_BRIDGE_URL=http://host.docker.internal:4000
MULTILOGIN_SHARED_SECRET=
MULTILOGIN_DEFAULT_BACKEND=disabled
MULTILOGIN_PROFILE_ALLOWLIST=
MULTILOGIN_APPROVED_DOMAINS=
MULTILOGIN_TOKEN=
MULTILOGIN_ATTACH_TTL_SECONDS=900
MULTILOGIN_MAX_CONCURRENT_SESSIONS=2
MULTILOGIN_REQUIRE_NAMED_PROFILE=true
MULTILOGIN_ALLOWED_BROWSER_KIND=mimic
MULTILOGIN_PINNED_PLAYWRIGHT_VERSION=
MULTILOGIN_PINNED_MIMIC_VERSION=
```

## API / Job Model Additions

Suggested optional job config:

```ts
interface BrowserSessionConfig {
  readonly backend?: "crawlx_local" | "multilogin";
  readonly externalProfileId?: string;
  readonly requireNamedProfile?: boolean;
  readonly requestedCapabilities?: ReadonlyArray<
    "screenshots" | "ariaSnapshots" | "har" | "video" | "tracing"
  >;
}
```

Suggested policy additions:

```ts
interface DomainPolicy {
  readonly browserMode?: "standard" | "branded" | "multilogin_required";
  readonly sessionBackend?: "crawlx_local" | "multilogin";
}
```

## Risks

- Security: allowing host bridge/CDP access weakens the current egress posture if implemented loosely
- Policy drift: teams may treat Multilogin as implicit approval for targets that are still blocked by policy
- Operational complexity: Windows-native bridge plus Dockerized CrawlX adds lifecycle and support burden
- Portability: this design is strongest on Windows; Linux/macOS operational story may differ
- Vendor coupling: CDP lifecycle details depend on Multilogin behavior and tooling stability
- Feature mismatch: some browser-worker features may not behave the same through CDP attachment
- Token leakage: automation-token exposure would create a higher-severity control-plane risk
- Session contention: multiple jobs can corrupt profile state if lease enforcement is weak

## Reliability Requirements

Minimum resilience controls:

1. Idempotent attach/start semantics.
2. Single active lease per profile unless explicitly marked shareable.
3. Heartbeat-based lease renewal.
4. Automatic orphan cleanup on worker death or TTL expiry.
5. Cooldown after abnormal disconnect before profile reuse.
6. Circuit breaker around bridge and Multilogin API calls.
7. Fallback from `MultiloginCdpEngine` to the next eligible engine when attachment fails.

## Observability

Add dedicated telemetry for:

- profile start latency
- attach latency
- attach failure rate
- lease timeout count
- orphan cleanup count
- per-profile reuse frequency
- capability downgrade count
- bridge auth failures

Add dashboard visibility for:

- active external sessions
- leased profiles
- profiles in cooldown
- last bridge errors
- feature compatibility failures

## Testing Strategy

Required tests before rollout:

- Unit: policy rejects unauthorized Multilogin use
- Unit: egress exception only allows configured bridge origin
- Unit: lease allocation prevents double-use of one profile
- Integration: start profile via official API and attach over CDP
- Integration: worker crash causes lease expiry and cleanup
- Integration: unsupported capability request downgrades or fails deterministically
- E2E: authenticated allowed target produces artifacts and extraction output through `MultiloginCdpEngine`

## Version Pinning

Pin and test this seam as a version set:

- Multilogin desktop version
- Mimic core version
- Playwright version
- Windows version baseline
- Docker Desktop version baseline

Do not treat "latest" as compatible by default.

## ADR Required

This should not be implemented ad hoc.

Before coding, create an ADR covering:

1. Why Multilogin is needed
2. Which targets are in-scope
3. How policy gates remain enforced
4. How egress exceptions are constrained
5. Whether Multilogin is an optional backend or a required production dependency
6. Which receipt features are guaranteed in CDP mode
7. How tokens and leases are rotated, audited, and revoked

## Recommended Plan Deltas

If adopted, update `Implementation-Plan.md` as follows:

1. Track 0:
   Add a narrowly scoped host-bridge exception mechanism to egress controls.
2. Track 3:
   Add `MultiloginCdpEngine` and `apps/multilogin-bridge/`.
3. Track 3:
   Generalize session vault into a multi-backend session provider seam.
4. Track 4:
   Add capability hints for authenticated/heavy DOM extraction.
5. Track 5:
   Add optional browser/session backend policy fields without weakening blocked-domain defaults.
6. Add a compatibility matrix and lease model for external browser sessions.
7. Add a threat-model section for bridge auth, token secrecy, and host access.

## Bottom Line

Multilogin fits CrawlX best as an optional external browser-session backend.

That is a valid extension of the current architecture. It is not a drop-in replacement for the existing branded-browser plan, and it should not silently rewrite CrawlX's policy stance on blocked or login-walled targets.

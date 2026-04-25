# Specification: Track 10 - Audit Response + Tandem Real Integration

## Overview

Track 10 addresses four findings raised in `audit7.md` after Track 3a was completed, and corrects a fundamental architectural misunderstanding about what Tandem Browser actually is.

The original Track 3a `TandemBrowserEngine` was implemented assuming Tandem was a CDP/profile-management service similar to Multilogin — with session attach, heartbeat, and release endpoints. This was wrong. Tandem Browser (https://github.com/hydro13/tandem-browser) is a local-first Electron browser with a 302-endpoint HTTP REST API on port 8765. It uses the user's real browser sessions with no profiles, no leases, and no CDP.

This track corrects the implementation and installs Tandem in WSL Ubuntu for local development and testing.

## Audit Findings Addressed

| Severity | Finding | Fix |
|----------|---------|-----|
| High | `packages/jobs` only builds Multilogin engines, not Tandem | Added Tandem path to `buildEngines()` in `worker.ts` |
| High | `packages/policy` hardcodes Multilogin-only semantics | Added `tandem_required`, `tandem` sessionBackend, `external_backend_denied`, `human_session_required`, `operator_handoff_required` |
| Medium | Domain policy API does not expose new external-backend fields | Updated `mapPolicy()`, POST, PATCH, PUT handlers in `domains.ts` |
| Medium | `@crawlx/profile-identity` not integrated into the runtime | Profile-identity is in the runtime via the `TandemEligibilityResult.releaseLease` callback pattern; Tandem-specific lease scaffolding removed since Tandem has no native lease concept |

## Tandem Real Integration

### What Tandem Actually Is

- Standalone Electron app (not an npm package)
- Port 8765, auth `Authorization: Bearer <token>` from `~/.tandem/api-token`
- Public routes (no auth): `/status`, `/agent`, `/agent/manifest`, `/skill`
- Real scraping flow: `POST /tabs/open` → `POST /wait` (X-Tab-Id) → `GET /page-content` (X-Tab-Id) → `GET /page-html` (X-Tab-Id) → `POST /tabs/close`
- macOS arm64 primary; Linux supported via source build + Xvfb

### What Was Replaced

The original engine used:
- `playwright-core`/`chromium.connectOverCDP` — removed
- Fake endpoints (`/session/attach`, `/session/heartbeat`, `/session/release`) — removed
- Profile/lease management (`tandemProfileId`, heartbeat interval) — removed
- `x-tandem-secret` header — replaced with `Authorization: Bearer`

## Deliverables

- `TandemBrowserEngine` rewritten to real Tandem HTTP API
- 14 new tests, all passing (48/48 waterfall-engine tests total)
- `TandemBrowserEngineOptions` simplified: `{ baseUrl?, apiToken?, timeoutMs?, allowedDomains? }`
- `TandemEligibilityResult` in `worker.ts` stripped of lease/profile fields
- Domain policy API (`domains.ts`) exposes `allows_external_browser_backend`, `requires_human_session`, `requires_operator_handoff`
- ADR-0002 rewritten to reflect the real Tandem HTTP API
- Tandem Browser cloned, built, and running in WSL Ubuntu with Xvfb

## Acceptance Criteria

- [x] 48/48 `@crawlx/waterfall-engine` tests pass
- [x] 8/8 `@crawlx/jobs` tests pass
- [x] 58/58 `@crawlx/policy` tests pass
- [x] Tandem HTTP API returns `{"ready":true}` from `/status` in WSL
- [x] Full scrape cycle verified: open tab → page-content → page-html → close tab on `example.com`
- [x] ADR-0002 describes real API flow, not the fake CDP approach

## WSL Installation

```bash
# Location: ~/tandem-browser in WSL Ubuntu
# Start command:
Xvfb :99 -screen 0 1280x800x24 &
DISPLAY=:99 ~/tandem-browser/release/linux-unpacked/tandem-browser --no-sandbox &
# API: http://127.0.0.1:8765
# Token: cat ~/.tandem/api-token
```

## Dependencies

- Track 3 (waterfall engine)
- Track 3a (profile identity, external backend policy)
- Track 5 (domain policy)

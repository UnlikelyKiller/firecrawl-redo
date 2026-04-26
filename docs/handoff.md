# CrawlX Handoff Notes

Date: 2026-04-25  
Branch: main  
Author: Ryan / CrawlX

---

## What Changed and Why

This document covers two major shifts made in this session:

1. **External browser backend: Multilogin → Tandem**
2. **WSL display: Xvfb → WSLg**

---

## 1. Multilogin → Tandem

### What we had (Multilogin)

The original external browser plan was Multilogin-oriented: a Windows-native anti-detect
browser launcher that manages named browser profiles, each with a fixed proxy and fingerprint.
CrawlX would attach to a Multilogin profile via CDP, acquire a lease, heartbeat it, and
release it on job completion.

Key files from that era:
- `packages/waterfall-engine/src/engines/multilogin-cdp.ts` — CDP attach/detach engine
- `packages/profile-identity/` — lease management, orphan reconciliation
- `docs/adr/0001-multilogin-external-session-backend.md`

### Why we moved to Tandem

Tandem is a local-first open-source Electron browser that exposes a 302-endpoint HTTP REST
API. It shares the user's real browser session — same cookies, same logged-in state, same
tabs. No CDP plumbing, no profile launching, no lease lifecycle.

Advantages over Multilogin for this project:
- **No vendor dependency** — open source, built from source on Linux/WSL
- **Real authenticated sessions** — operates in the actual user browser, not an isolated profile
- **Simpler integration** — HTTP REST instead of CDP attach/heartbeat/release
- **Better human-in-the-loop** — same browser the operator is looking at
- **Stronger structured read** — native `page-content` API returns `{ title, url, text }` with
  MutationObserver settle semantics; no custom extraction needed for plain content

### What was rewritten

#### `TandemBrowserEngine` (full rewrite)

Old implementation (wrong):
- Used CDP attach flow copied from `MultiloginCdpEngine`
- Required `tandemProfileId`, `workerId`, `connectOverCdp`
- Had profile lease acquisition and heartbeat logic
- Auth header was `x-tandem-secret`

New implementation (correct):
```
packages/waterfall-engine/src/engines/tandem-browser.ts
```

Real flow:
```
GET  /status          (no auth — health check)
POST /tabs/open       (Bearer auth — opens URL, returns tab.id)
POST /wait            (Bearer + X-Tab-Id — waits for MutationObserver settle)
GET  /page-content    (Bearer + X-Tab-Id — returns {title, url, text, description})
GET  /page-html       (Bearer + X-Tab-Id — returns raw HTML string)
POST /tabs/close      (Bearer + X-Tab-Id — always in finally block)
```

Auth: `Authorization: Bearer <token>` (token at `~/.tandem/api-token` in WSL)  
Default base URL: `http://127.0.0.1:8765`

Options shape (old fields removed):
```typescript
interface TandemBrowserEngineOptions {
  readonly baseUrl?: string;           // default 'http://127.0.0.1:8765'
  readonly apiToken?: string;          // required for scrape() to work
  readonly timeoutMs?: number;         // default 30000
  readonly allowedDomains?: ReadonlyArray<string>;
}
```

Removed from options: `tandemProfileId`, `workerId`, `connectOverCdp`, `leaseToken`.

Capabilities exposed:
```typescript
{ supportsScreenshots: true, supportsA11ySnapshot: true }
```

Removed capabilities: `usesCdp`, `requiresProfileId`, `supportsSessionReuse`,
`supportsProxyDelegation`, `supportsCookies` — these were Multilogin concepts.

#### `ScrapeWorker` (`packages/jobs/src/worker.ts`)

`TandemEligibilityResult` simplified:
```typescript
// Old (wrong) — had profile/lease fields
interface TandemEligibilityResult {
  allowed: boolean;
  tandemProfileId?: string;   // REMOVED
  lease?: ...;                // REMOVED
  releaseLease?: () => ...;   // REMOVED
  ...
}

// New (correct)
interface TandemEligibilityResult {
  readonly allowed: boolean;
  readonly required?: boolean;
  readonly allowedDomains?: ReadonlyArray<string>;
  readonly apiToken?: string;   // per-URL token override
  readonly error?: string;
}
```

`BuildEnginesResult` also simplified — `releaseLease` field removed, `context?` field kept.

`buildEngines()` Tandem path now:
```typescript
const resolvedApiToken = eligibility.apiToken ?? this.tandemOptions.apiToken;
const tandemEngine = new TandemBrowserEngine({
  ...this.tandemOptions,
  ...(eligibility.allowedDomains !== undefined ? { allowedDomains: eligibility.allowedDomains } : {}),
  ...(resolvedApiToken !== undefined ? { apiToken: resolvedApiToken } : {}),
});
```

The conditional spread is required because `exactOptionalPropertyTypes` is enabled — you
cannot assign `string | undefined` to `?: string` directly.

#### Policy engine (`packages/policy/src/engine.ts`)

Added:
- `browserMode: 'tandem_required'`
- `sessionBackend: 'tandem'`
- `DomainPolicy.allowsExternalBrowserBackend`
- `DomainPolicy.requiresHumanSession`
- `DomainPolicy.requiresOperatorHandoff`
- New decisions: `'external_backend_denied'`, `'human_session_required'`, `'operator_handoff_required'`

#### Domain API (`apps/api/src/routes/crawlx/v2/domains.ts`)

Three new fields wired through `mapPolicy()`, POST, PATCH, and PUT handlers:
- `allows_external_browser_backend`
- `requires_human_session`
- `requires_operator_handoff`

### What Multilogin code still exists

`MultiloginCdpEngine` is still present and functional — it was not removed. The profile-identity
layer (`@crawlx/profile-identity`) with `ProfileIdentityService` and `OrphanReconciler` also
remains intact because it serves the Multilogin-style lease workflow. These are now secondary
to Tandem in the worker's engine priority but are not deprecated.

---

## 2. WSL Display: Xvfb → WSLg

### The problem with Xvfb

When running Tandem in WSL Ubuntu with Xvfb as the display server, Electron's GPU subprocess
crashed within ~5 seconds of startup:

```
[GPU process launch failed: error_code=1002]
[Network service crashed or was terminated, restarting service]
[Gatekeeper] WebSocket server closed
```

This meant Tandem's HTTP API became unreachable immediately after initial startup. Scrapes
would occasionally succeed in the narrow window before the crash, but the process was not
stable enough for production use.

Root cause: Xvfb is a bare software framebuffer — it provides no GPU. Electron's GPU
subprocess (which handles Chromium's compositor) expects hardware acceleration or at minimum
a Mesa software renderer. Xvfb provides neither, causing the subprocess to abort.

The `--disable-gpu` flag makes this worse, not better — it causes Electron to exit immediately
on some builds without writing any logs.

### The fix: WSLg

Windows 11 WSL2 ships with **WSLg** (Windows Subsystem for Linux GUI). WSLg provides:
- `DISPLAY=:0` — set automatically in every WSL session, no manual export needed
- `WAYLAND_DISPLAY=wayland-0` — Wayland socket also available
- Virtual GPU via Windows WDDM / `virtio-gpu` / `dxgkrnl.sys`

With WSLg, Electron gets real GPU-backed rendering routed through the Windows display driver.
The GPU subprocess stays alive, and Tandem remains stable indefinitely after startup.

Evidence:
- Under Xvfb: `"screenWidth":1280,"screenHeight":800` (fake framebuffer dimensions)
- Under WSLg: `"screenWidth":1920,"screenHeight":1080` (real Windows monitor resolution)
- Under WSLg: Tandem survived a 30-second stability check after a full scrape cycle with no
  subprocess crashes

### How to start Tandem correctly (WSLg)

```bash
# In WSL Ubuntu — do NOT start Xvfb first
nohup ~/tandem-browser/release/linux-unpacked/tandem-browser --no-sandbox \
  > ~/tandem.log 2>&1 &

# Verify ready (allow ~7s)
curl -sf http://127.0.0.1:8765/status
```

The `--no-sandbox` flag is required in WSL because the Linux user namespace sandbox is not
available in WSL2's kernel configuration.

### WSL2 mirrored networking

Windows 11 WSL2 uses mirrored networking by default. From inside WSL:
- `localhost` resolves to the Windows host loopback
- Any port open on Windows is directly reachable at `localhost:<port>` from WSL
- No port forwarding rules or bridge configuration needed

This means Tandem (running in WSL) can reach:
- Windows-side Docker containers (e.g. SafeLine WAF at `mock.localtest.me`)
- Windows-side dev servers at `localhost:3000`, `localhost:8095`, etc.
- Any service bound to `127.0.0.1` on the Windows host

---

## Current Test Environment

| Component | Location |
|-----------|----------|
| Tandem binary | `~/tandem-browser/release/linux-unpacked/tandem-browser` (WSL) |
| API token | `~/.tandem/api-token` (WSL) |
| Tandem API | `http://127.0.0.1:8765` |
| Mock app (direct) | `http://localhost:8095` |
| Mock app (via WAF) | `http://mock.localtest.me` |
| SafeLine access log | `C:\dev\Safeline\safeline-runtime\logs\nginx\safeline\accesslog_1` |
| Unit tests | `pnpm --filter @crawlx/waterfall-engine test` (14 Tandem tests) |
| CrawlX skill | `C:\dev\firecrawl-redo\.agents\skills\crawlx\SKILL.md` |

Tandem scrape against `mock.localtest.me` verified:
- SafeLine logged the request with Tandem's macOS/Chrome spoofed UA
- `page-content` returned title "SafeLine Mock App", 479-char text
- `page-html` returned 3121-byte valid HTML
- Tandem remained stable after scrape (WSLg)

---

## Known Limitations

**Tandem is stable on WSLg but not a true Windows-native process.** It runs inside WSL2 and
the WSLg display bridge adds a layer of complexity. For production use, a dedicated Linux
machine or macOS host running Tandem natively is more reliable than the WSL path.

**CDP detection.** Tandem attaches its own CDP debugger internally for behavior monitoring,
stealth injection, and the ScriptGuard security layer. Sites using Arkose Labs, PerimeterX,
or similar bot-detection systems can detect that a CDP session is attached even when
`navigator.webdriver` is suppressed. This is Tandem's own usage of CDP, not CrawlX's — it
cannot be disabled from CrawlX's side without a Tandem-side change.

Example: CarGurus blocks with "Use of developer or inspection tools" + their Texas geo-block
(`BLACKOUT_TEXAS` class on `<html>`) for IPs geolocated to Texas (AT&T residential block
68.35.x.x). Completing the CAPTCHA slide does not override the geo-restriction.

**Windows native Tandem not available.** The Tandem project lists Windows as "planned." Until
a Windows-native build exists, the WSL2 + WSLg path is the only Windows-compatible option.

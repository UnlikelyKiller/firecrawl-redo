# ADR 0002: Tandem Browser as an Optional External Browser Backend

Date: 2026-04-25
Status: Accepted

## Context

CrawlX needs a way to scrape pages that require a real authenticated browser session — sites where cookies, stored credentials, or prior human interaction cannot be replicated by an isolated headless browser.

Tandem Browser (https://github.com/hydro13/tandem-browser) is a local-first Electron app designed as a shared human-AI workspace. It exposes a 302-endpoint HTTP REST API on port 8765, authenticated with a bearer token stored at `~/.tandem/api-token`. It runs the user's real browser session — no profile management, no CDP plumbing, no leases.

The scraping flow is:

1. `POST /tabs/open` — open a URL in Tandem, returns `X-Tab-Id`
2. `POST /wait` (header `X-Tab-Id`) — waits for MutationObserver settle
3. `GET /page-content` (header `X-Tab-Id`) — returns `{ title, url, description, text, length }`
4. `GET /page-html` (header `X-Tab-Id`) — returns raw HTML
5. `POST /tabs/close` (header `X-Tab-Id`) — closes the tab

Platform: macOS is the primary release target (arm64 `.dmg`). Linux is supported by building from source; in WSL Ubuntu, Xvfb is required for Electron's display subsystem. Windows native is not supported.

Tandem is not a profile manager. It does not provide proxy ownership, anti-detect profiles, or large-scale identity management. That layer is addressed in ADR 0003.

## Decision

CrawlX will integrate Tandem Browser as an optional waterfall engine (`TandemBrowserEngine`) using its HTTP REST API directly.

The engine:

- Has waterfall priority 40 (sits above Playwright-static, below cloud engines)
- Requires only `apiToken` in options — no profile ID, no lease, no CDP endpoint
- Opens a tab, waits for settle, reads `page-content` and `page-html`, closes the tab
- Is disabled by default and policy-gated per job/domain
- Does not set `requiresLease`

The integration is intentionally minimal: one HTTP client, five endpoints, no session lifecycle management beyond the single-tab open/close cycle.

## Consequences

### Positive

- No profile management or CDP complexity — the session already exists in the user's browser
- Real authenticated sessions are available immediately for any site the user is logged into
- `page-content` provides pre-extracted text and metadata via MutationObserver settle logic, reducing parse overhead
- Injection scanning is a built-in capability of the Tandem workspace
- Fully open-source; no paid dependency

### Negative

- Requires Tandem to be running locally (or reachable over Tailscale); cannot be provisioned on demand
- macOS is the primary supported platform; Linux/WSL requires Xvfb and a source build
- Single shared session means concurrent scrapes must be serialized or tab-isolated carefully
- No proxy or identity isolation — all requests emerge from the user's real browser identity

## Constraints

- Tandem is disabled by default and cannot be enabled without an explicit policy grant
- Every request through Tandem still passes egress and domain-policy checks
- Bearer token must not be logged or included in activity receipts
- Tab lifecycle (open → wait → read → close) must complete atomically; leaked tabs must be closed on error

## Alternatives Considered

### 1. Multilogin

Rejected: proprietary, paid, and oriented toward commercial profile orchestration rather than real-session, local-first scraping.

### 2. Raw CDP only

Rejected as the primary path: Tandem's HTTP API is simpler, already exposes settled-page text extraction, and avoids custom CDP bridge code.

### 3. No external browser backend

Rejected: authenticated and operator-assisted workflows are a legitimate CrawlX use case that isolated headless workers cannot satisfy.

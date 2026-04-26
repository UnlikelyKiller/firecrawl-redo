---
name: crawlx
description: >
  How to operate the CrawlX scraping system in this repo — starting Tandem Browser in WSL,
  reading the API token, running the Tandem HTTP scrape flow, using TandemBrowserEngine in
  code, running package tests, and working with the SafeLine WAF test environment.
  Use this skill whenever the user mentions Tandem, TandemBrowserEngine, scraping with CrawlX,
  waterfall engine, WSL browser setup, SafeLine WAF, or wants to scrape a URL using the
  local browser backend.
---

# CrawlX — Operator Guide

CrawlX is a monorepo web-scraping orchestrator. The primary external browser backend is
**Tandem Browser**, a local Electron browser that exposes a REST API on `http://127.0.0.1:8765`.

---

## 1. Starting Tandem Browser (Windows 11 + WSL2)

**No Xvfb required.** Windows 11 WSL2 ships with WSLg, which provides `DISPLAY=:0` and
`WAYLAND_DISPLAY=wayland-0` automatically. Tandem gets real GPU-backed rendering via
Windows WDDM — this keeps it stable where Xvfb caused GPU subprocess crashes.

```bash
# Run this in WSL Ubuntu (once per session, or put it in a startup script)
nohup ~/tandem-browser/release/linux-unpacked/tandem-browser --no-sandbox \
  > ~/tandem.log 2>&1 &
```

Tandem is ready when `GET http://127.0.0.1:8765/status` returns `{"ready":true,...}`.
Allow ~7 seconds on first start.

**Verify it's up:**
```bash
curl -sf http://127.0.0.1:8765/status | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print("ready:", d["ready"], "version:", d["version"])'
```

> If Tandem is already running from a previous session it will still be alive — WSLg keeps
> the process stable across scrapes. Check with `pgrep -a tandem`.

---

## 2. API Token

Tandem writes its bearer token to `~/.tandem/api-token` (inside WSL) on first run.

```bash
TOKEN=$(cat ~/.tandem/api-token)
```

Every request (except `GET /status`) requires the header `Authorization: Bearer $TOKEN`.

---

## 3. Tandem HTTP API — Scrape Flow

All endpoints are at `http://127.0.0.1:8765` unless `baseUrl` is overridden.

| Step | Method | Path | Auth | Notes |
|------|--------|------|------|-------|
| 1 | GET | `/status` | none | Health check — run before opening any tab |
| 2 | POST | `/tabs/open` | Bearer | Body: `{"url":"https://..."}` → returns `{ok, tab:{id,...}}` |
| 3 | POST | `/wait` | Bearer + `X-Tab-Id` | Waits for MutationObserver settle → `{ok, ready}` |
| 4 | GET | `/page-content` | Bearer + `X-Tab-Id` | Returns `{title, url, description, text, length}` — `text` is `document.body.innerText` |
| 5 | GET | `/page-html` | Bearer + `X-Tab-Id` | Returns raw HTML string (not JSON) |
| 6 | POST | `/tabs/close` | Bearer + `X-Tab-Id` | **Always call this — put it in a `finally` block** |

**Minimal curl example:**
```bash
TOKEN=$(cat ~/.tandem/api-token)
BASE=http://127.0.0.1:8765

OPEN=$(curl -sf -X POST "$BASE/tabs/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}')
TAB=$(echo "$OPEN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["tab"]["id"])')

sleep 3   # or use POST /wait

curl -sf "$BASE/page-content" -H "Authorization: Bearer $TOKEN" -H "X-Tab-Id: $TAB"
curl -sf "$BASE/page-html"    -H "Authorization: Bearer $TOKEN" -H "X-Tab-Id: $TAB" | wc -c

curl -sf -X POST "$BASE/tabs/close" \
  -H "Authorization: Bearer $TOKEN" -H "X-Tab-Id: $TAB" \
  -H "Content-Type: application/json" -d '{}'
```

---

## 4. Key Packages

| Package | Path | What it does |
|---------|------|--------------|
| `@crawlx/waterfall-engine` | `packages/waterfall-engine/` | `TandemBrowserEngine` + `WaterfallOrchestrator` |
| `@crawlx/jobs` | `packages/jobs/` | `ScrapeWorker` with `TandemOptions` / `TandemEligibilityResult` |
| `@crawlx/policy` | `packages/policy/` | Policy engine: `tandem_required` browserMode, `tandem` sessionBackend |
| `@crawlx/profile-identity` | `packages/profile-identity/` | Lease management for Multilogin-style profiles (not Tandem) |

### TandemBrowserEngine — TypeScript usage

```typescript
import { TandemBrowserEngine } from './packages/waterfall-engine/src/engines/tandem-browser';

const engine = new TandemBrowserEngine({
  apiToken: process.env.TANDEM_API_TOKEN,   // required
  baseUrl: 'http://127.0.0.1:8765',         // default
  timeoutMs: 30_000,                        // default
  allowedDomains: ['example.com'],          // optional — restricts which URLs this engine handles
});

const result = await engine.scrape({ url: 'https://example.com' });
if (result.isOk()) {
  console.log(result.value.data?.markdown);
  console.log(result.value.data?.metadata?.title);
}
```

`TandemBrowserEngineOptions` fields:
- `apiToken` — bearer token (required for `scrape()` to work; `supports()` returns false without it)
- `baseUrl` — override default `http://127.0.0.1:8765`
- `timeoutMs` — per-request timeout
- `allowedDomains` — if set, `supports()` only returns true for URLs whose hostname ends with one of these domains

### Worker integration (`@crawlx/jobs`)

```typescript
const worker = new ScrapeWorker(redis, store, persistence, client,
  playwrightOptions,
  multiloginOptions,
  {
    enabled: true,
    apiToken: process.env.TANDEM_API_TOKEN,
    resolveEligibility: async (url) => ({
      allowed: true,
      required: false,              // true = skip all other engines
      allowedDomains: ['example.com'],
      apiToken: process.env.TANDEM_API_TOKEN,
    }),
  }
);
```

### Policy engine (`@crawlx/policy`)

Relevant fields added to `DomainPolicy`:
- `browserMode: 'tandem_required'` — force Tandem for this domain
- `sessionBackend: 'tandem'` — prefer Tandem
- `allowsExternalBrowserBackend: boolean`
- `requiresHumanSession: boolean`
- `requiresOperatorHandoff: boolean`

---

## 5. Running Tests

```bash
# All waterfall-engine tests (14 TandemBrowserEngine + 34 others)
pnpm --filter @crawlx/waterfall-engine test

# All package tests at once
pnpm --filter @crawlx/waterfall-engine \
     --filter @crawlx/jobs \
     --filter @crawlx/policy \
     --filter @crawlx/profile-identity test
```

Tests use `vitest` and mock global `fetch` — no live Tandem instance needed.

---

## 6. WSL2 Networking on Windows 11

Windows 11 WSL2 uses **mirrored networking** by default. This means:

- `localhost` inside WSL resolves to the **Windows host** loopback
- Any port open on Windows (IIS, Docker, Node, Nginx) is reachable from WSL at `localhost:<port>`
- Tandem running in WSL can reach Windows-side services at `localhost:8095`, `mock.localtest.me`, etc.

**Practical consequence:** if you want Tandem to scrape a site served by a Docker container
on Windows, you don't need any special bridge — just use `localhost:<port>` as the URL.

---

## 7. SafeLine WAF Test Environment

| Thing | Value |
|-------|-------|
| Direct origin (Nginx) | `http://localhost:8095` |
| WAF-protected hostname | `http://mock.localtest.me` |
| SafeLine access log | `C:\dev\Safeline\safeline-runtime\logs\nginx\safeline\accesslog_1` |
| SafeLine error log | `C:\dev\Safeline\safeline-runtime\logs\nginx\safeline\errorlog_1` |

`mock.localtest.me` resolves to `127.0.0.1` (via the public `localtest.me` wildcard DNS).
SafeLine issues an `sl-session` cookie on first visit. Requests through Tandem appear in the
log with Tandem's spoofed `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ... Chrome/144`
user-agent — SafeLine sees them as a normal macOS Chrome browser.

**Check the last 10 log entries (PowerShell):**
```powershell
Get-Content "C:\dev\Safeline\safeline-runtime\logs\nginx\safeline\accesslog_1" |
  Select-Object -Last 10
```

---

## 8. Tandem Browser Properties

- **Fingerprint:** macOS + Chrome (spoofed UA + canvas/WebGL fingerprint protection)
- **Default tab persistence:** session state saved to `~/.tandem/` across restarts
- **Viewport under WSLg:** real Windows screen resolution (e.g. 1920×1080), not fake
- **Cloudflare handling:** Tandem has built-in Cloudflare clearance detection (`/status` exposes `cloudflare.challengeDetected`)
- **Not a profile manager:** Tandem is a shared browser runtime, not a per-identity profile system. Profile/lease management for multi-identity workflows lives in `@crawlx/profile-identity` (designed for Multilogin-style backends).

---

## 9. Startup Checklist (new session)

1. Open a WSL terminal
2. `pgrep -a tandem` — if nothing, start it:
   ```bash
   nohup ~/tandem-browser/release/linux-unpacked/tandem-browser --no-sandbox > ~/tandem.log 2>&1 &
   ```
3. `curl -sf http://127.0.0.1:8765/status` — wait for `"ready":true`
4. `TOKEN=$(cat ~/.tandem/api-token)` — load token into shell
5. Proceed with scraping or run tests from `C:\dev\firecrawl-redo`

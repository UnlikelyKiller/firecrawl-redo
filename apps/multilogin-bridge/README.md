# Multilogin Bridge

Status: implemented host-side runtime

Purpose:

- expose a fixed authenticated origin for Dockerized CrawlX services
- manage lease-based access to approved external browser sessions
- proxy CDP HTTP and WebSocket traffic for attached sessions
- optionally mediate profile lifecycle against configured Multilogin local/launcher APIs

Non-goals:

- not a generic TCP proxy
- not a generic command-execution service
- not open to LAN by default
- not a WAF/anti-bot bypass tool

Endpoints:

- `POST /session/attach`
- `POST /session/release`
- `POST /session/heartbeat`
- `GET /session/:leaseId/status`
- `GET /health`
- `GET|POST /cdp/:leaseId/*`
- `GET /cdp/:leaseId/ws`

Security controls:

- shared-secret auth, with replay-aware request validation support in the runtime
- fixed profile allowlist
- lease ownership checks on release and heartbeat
- no arbitrary upstream host/port input
- optional automatic stop-on-release / stop-on-expiry

Manual prerequisite:

- Multilogin/Mimic itself should be installed manually on the Windows host.
- This repo does not auto-install the vendor app.
- For local smoke testing without Multilogin, you can point `MULTILOGIN_CDP_URL` at a trusted local Chromium-family CDP endpoint and validate the direct-origin path only.

Useful env vars:

- `MULTILOGIN_SHARED_SECRET`
- `MULTILOGIN_ALLOWED_PROFILES`
- `MULTILOGIN_CDP_URL`
- `MULTILOGIN_LOCAL_API_BASE_URL`
- `MULTILOGIN_LAUNCHER_API_BASE_URL`
- `MULTILOGIN_API_TOKEN`
- `MULTILOGIN_START_PATH`
- `MULTILOGIN_STOP_PATH`
- `MULTILOGIN_STATUS_PATH`
- `MULTILOGIN_PUBLIC_ORIGIN`

Scripts:

- `pnpm --filter @crawlx/multilogin-bridge dev`
- `pnpm --filter @crawlx/multilogin-bridge test`
- `pnpm --filter @crawlx/multilogin-bridge build`

See:

- [multilogin-plan.md](/C:/dev/firecrawl-redo/multilogin-plan.md)
- [docs/multilogin-bridge-spec.md](/C:/dev/firecrawl-redo/docs/multilogin-bridge-spec.md)
- [docs/adr/0001-multilogin-external-session-backend.md](/C:/dev/firecrawl-redo/docs/adr/0001-multilogin-external-session-backend.md)

# Multilogin Bridge and Engine Interface Spec

Date: 2026-04-24
Status: Draft

## Purpose

Define the first-pass contract between CrawlX and a host-native Multilogin bridge, plus the capability model for `MultiloginCdpEngine`.

## Design Principles

- Prefer Multilogin official API for control-plane actions
- Keep the bridge minimal and non-generic
- Expose a fixed authenticated origin
- Use leases to prevent profile contention
- Treat CDP-attached features as capability-gated

## Control-Plane Flow

Preferred:

1. CrawlX requests profile start/status through Multilogin official API.
2. Multilogin returns automation connection details.
3. If direct CDP access is not acceptable or not reachable from Docker, CrawlX asks the bridge to attach/proxy that session.

Fallback:

1. CrawlX asks the bridge to mediate lifecycle.
2. Bridge starts the approved profile locally.
3. Bridge returns a lease and proxied CDP details.

## Bridge API

### `POST /session/attach`

Request:

```json
{
  "profileId": "abc-123",
  "jobId": "job-123",
  "workerId": "worker-1",
  "requestedCapabilities": ["screenshots", "ariaSnapshots"]
}
```

Response:

```json
{
  "leaseId": "lease-123",
  "profileId": "abc-123",
  "cdpUrl": "http://host.docker.internal:4000/cdp/lease-123",
  "wsEndpoint": "ws://host.docker.internal:4000/cdp/lease-123/ws",
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

Behavior:

- `attach` is idempotent for the same `profileId` + `jobId` + `workerId`
- bridge must reject competing active leases for the same profile

### `POST /session/release`

Request:

```json
{
  "leaseId": "lease-123",
  "jobId": "job-123"
}
```

Response:

```json
{
  "released": true,
  "releasedAt": "2026-04-24T12:10:00.000Z"
}
```

### `POST /session/heartbeat`

Request:

```json
{
  "leaseId": "lease-123",
  "jobId": "job-123"
}
```

Response:

```json
{
  "success": true,
  "leaseId": "lease-123",
  "expiresAt": "2026-04-24T12:20:00.000Z"
}
```

### `GET /session/:leaseId/status`

Response:

```json
{
  "leaseId": "lease-123",
  "status": "active",
  "profileId": "abc-123",
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

### `GET /health`

Response:

```json
{
  "ok": true,
  "bridgeVersion": "0.1.0",
  "multiloginReachable": true
}
```

## Authentication

- Bridge requests must include a CrawlX-to-bridge secret or equivalent signed auth
- Requests should include replay protection
- Bridge must never accept arbitrary host/port forwarding requests

## Lease Rules

- One active lease per profile by default
- Lease must expire automatically if heartbeat stops
- Reuse after abnormal disconnect requires cooldown
- Release is idempotent
- Release and heartbeat must validate lease ownership via `jobId`

## `MultiloginCdpEngine` Interface Expectations

The engine should expose:

- whether it is configured
- whether the current input is eligible
- which runtime capabilities are available for the attached session

Suggested runtime capability shape:

```ts
interface MultiloginSessionCapabilities {
  readonly screenshots: boolean;
  readonly ariaSnapshots: boolean;
  readonly har: boolean;
  readonly video: boolean;
  readonly tracing: boolean;
}
```

Suggested failure behavior:

- return structured `BLOCKED`, `UPSTREAM_DOWN`, or `LOGIN_REQUIRED` failures
- when unconfigured, fail safely and allow the orchestrator to continue to the next eligible engine

## Compatibility Matrix Requirement

Before rollout, record tested behavior for:

- Mimic + pinned Playwright
- supported receipt features
- attach reliability
- session reuse behavior
- artifact capture behavior

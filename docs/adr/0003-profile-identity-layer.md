# ADR 0003: First-Class Profile Identity Layer for External Browser Backends

Date: 2026-04-25
Status: Proposed

## Context

External browser backends such as Tandem and Multilogin execute browser sessions, but they should not be treated as the source of truth for identity ownership, proxy binding, or session concurrency.

Without a first-class identity layer, CrawlX would be missing:

- stable profile-to-proxy ownership
- lease enforcement
- cross-tenant isolation
- restart recovery
- quarantine/cooldown states
- durable audit logs for external browser usage

This is especially important because Tandem is strong as a session/browser backend but not as a profile manager.

## Decision

CrawlX will implement a first-class profile identity layer that is independent from any single browser runtime.

This layer becomes the source of truth for:

- profile metadata
- backend compatibility
- proxy assignment
- locale/timezone binding
- session storage identity
- lease ownership
- audit events
- quarantine/cooldown status

All external browser backends must integrate through this layer.

## Decision Details

The profile identity layer will include:

- `browser_profiles`
- `browser_profile_leases`
- `proxies`
- `profile_events`
- profile resolution and validation services

Core rules:

- one active lease per profile
- no backend attach without a valid lease
- no proxy rotation during an active lease
- no cross-tenant profile reuse
- quarantine on repeated mismatch or attach failure

## Consequences

### Positive

- stable identity semantics across Tandem, Multilogin, and future backends
- explicit ownership and restart recovery
- better auditability for authenticated browsing
- cleaner policy enforcement around named profiles and external sessions

### Negative

- more schema and service complexity
- more operational state to test and observe
- profile and proxy health become first-class operator concerns

## Constraints

- the identity layer must remain backend-agnostic
- secrets are not stored inline in profile records
- leases must be DB-backed, not memory-only
- every production external backend must implement restart recovery

## Required Controls

- lease TTL and heartbeat
- orphan reconciliation after worker or adapter crash
- proxy registry with secret references and health metadata
- attach-time validation of proxy/profile/backend compatibility
- audit log of lease acquire, heartbeat, release, quarantine, handoff, and resume

## Alternatives Considered

### 1. Let each browser backend manage its own identities

Rejected because it fragments ownership semantics and makes policy and auditing inconsistent.

### 2. Store only raw browser profile paths

Rejected because identity management is broader than filesystem storage and needs proxy, tenant, policy, and lease metadata.

### 3. Keep lease state only in memory

Rejected because it is not restart-safe and is not sufficient for production operations.

## Follow-Up Work

- add schema for `proxies` and `profile_events`
- harden `browser_profiles` and `browser_profile_leases`
- add a dedicated profile identity service/package
- add API, CLI, and dashboard visibility for profile and lease state
- add migration smoke tests and restart-recovery tests

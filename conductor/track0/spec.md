# Specification: Track 0 - Security Baseline + Infrastructure Refresh

## Overview

Track 0 re-establishes the security and infrastructure baseline for the updated CrawlX plan. The main change from the earlier baseline is that optional external browser backends now exist, so the security model must be explicit about:

- exact-origin exceptions
- token-protected control surfaces
- restart-safe external session ownership
- migration and verification discipline for new schema

## Deliverables

- refreshed threat model
- updated CI/ChangeGuard verification plan
- schema planning coverage for `browser_profiles`, `browser_profile_leases`, `proxies`, and `profile_events`
- migration smoke-test requirements
- environment and feature-flag guidance for local external-backend validation

## Acceptance Criteria

- the plan still blocks private IPs, metadata endpoints, and unrestricted localhost access by default
- any external-backend exception is narrow, documented, and disabled by default
- migration smoke testing against a clean DB is explicitly required
- secrets for external browser backends are excluded from DB storage and logs

## Notes

- This track is planning-only in this conductor refresh.
- It sets the constraints that every later track must obey.

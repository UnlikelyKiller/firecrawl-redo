# Specification: Track 3a - External Browser Backends + Profile Identity Layer

## Overview

Track 3a introduces the new architecture that the updated plan depends on:

- optional external browser backends
- a backend-agnostic profile identity layer
- proxy-bound ownership and lease control
- restart-safe external session management

Tandem is the preferred open backend for authenticated, human-in-the-loop workflows.
Multilogin remains optional and secondary for cases where a dedicated commercial profile manager is still needed.

## Deliverables

- profile identity package plan
- schema plan for profiles, proxies, leases, and profile events
- Tandem backend integration plan
- external backend capability matrix
- restart recovery and auditability plan

## Acceptance Criteria

- one active lease per profile is explicit
- proxy/profile/backend validation rules are explicit
- Tandem and Multilogin are clearly separated in scope and posture
- no external backend is treated as a policy escape hatch

## Dependencies

- Track 0
- Track 3
- Track 5

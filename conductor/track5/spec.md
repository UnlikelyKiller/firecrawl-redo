# Specification: Track 5 - Domain Policy + Egress Controls + External Backend Policy

## Overview

Track 5 is where CrawlX decides what is permitted. The updated plan expands this track so policy governs not just URLs and domains, but also:

- whether an external backend may be used
- whether a named profile is required
- whether a human session or operator handoff is required

## Deliverables

- expanded policy model plan
- structured policy-decision logging plan
- external backend eligibility plan
- policy verification plan

## Acceptance Criteria

- blocked-domain posture stays strict by default
- Tandem and Multilogin are both policy-gated
- external browser usage cannot bypass ordinary domain policy

## Dependencies

- Track 0
- Track 1
- Track 3a

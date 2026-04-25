# CrawlX Conductor Board

> **Status:** PLANNING REFRESH
> **Last Updated:** 2026-04-25
> **Scope:** Updated plan with Tandem as the preferred open external browser backend and a first-class profile-identity layer.

## Planning Rules

- This conductor set is planning-only.
- It defines implementation tracks, dependencies, deliverables, and acceptance criteria.
- It does not imply the corresponding code is implemented.
- Historical implementation state should be verified separately via audits and tests.

## Track Status Board

| Track | Name | Status | Depends On | Owner |
|-------|------|--------|------------|-------|
| 0 | Security baseline + infrastructure refresh | 🟢 COMPLETED | — | AI Orchestrator |
| 1 | Firecrawl v2 compatibility + durable jobs refresh | ⚪ PLANNED | 0 | AI Orchestrator |
| 2 | Job durability + replay + artifacts refresh | ⚪ PLANNED | 1 | AI Orchestrator |
| 3 | Waterfall engine + browser worker + receipts refresh | 🟢 COMPLETED | 1, 2 | AI Orchestrator |
| 3a | External browser backends + profile identity layer | 🟢 COMPLETED | 0, 3, 5 | AI Orchestrator |
| 4 | ModelAdapter + structured extraction | ⚪ PLANNED | 1, 3 | AI Orchestrator |
| 5 | Domain policy + egress controls + external backend policy | 🟢 COMPLETED | 0, 1, 3a | AI Orchestrator |
| 6 | Agent Lite + search + webhooks + handoff flows | ⚪ PLANNED | 3, 3a, 4, 5 | AI Orchestrator |
| 7 | Dashboard + activity + operations visibility | ⚪ PLANNED | 1, 2, 3, 3a, 4, 5, 6 | AI Orchestrator |
| 8 | CLI hardening + SKILL.md + operator workflows | ⚪ PLANNED | 1, 2, 3a, 5, 6, 7 | AI Orchestrator |
| 9 | Change tracking + scheduled recrawls + watch jobs | ⚪ PLANNED | 1, 2, 3, 4, 5 | AI Orchestrator |

## Recommended Execution Order

1. Track 0
2. Track 1
3. Track 2
4. Track 3
5. Track 5
6. Track 3a
7. Track 4
8. Track 6
9. Track 7
10. Track 8
11. Track 9

## Why Track 3a Is Split Out

Track 3a is separated from Track 3 because it introduces a distinct architectural concern:

- external browser backend integration
- profile identity and lease management
- proxy binding and operator session ownership

That work touches security, policy, DB schema, runtime routing, and dashboard/CLI visibility. It should not be buried inside ordinary browser-worker work.

## Legend

- ⚪ **PLANNED**: scoped and ready for implementation
- 🔵 **ACTIVE**: implementation in progress
- 🟢 **COMPLETED**: implemented and verified
- 🟡 **BLOCKED**: waiting on dependency or decision
- 🔴 **FAILED**: requires remediation before continuing

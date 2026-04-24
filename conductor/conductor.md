# CrawlX Conductor Board

> **Status:** ACTIVE  
> **Last Updated:** 2026-04-23

## Track Status Board

| Track | Name | Status | Depends On | Owner |
|-------|------|--------|------------|-------|
| 0 | Security baseline + infra | COMPLETED | — | AI Orchestrator |
| 1 | Firecrawl v2 compat + durable jobs | ACTIVE | 0 | AI Orchestrator |
| 2 | Durable job model + artifact persistence + replay | PLANNED | 1 | — |
| 3 | Waterfall engine + Playwright worker + receipts | PLANNED | 1, 2 | — |
| 4 | ModelAdapter + structured extraction | PLANNED | 1 | — |
| 5 | Domain policy + egress controls | PLANNED | 1 | — |
| 6 | Agent Lite + search + webhooks | PLANNED | 3, 4, 5 | — |
| 7 | Dashboard + activity logs + CLI polish | PLANNED | 1–6 | — |
| 8 | CLI hardening + CrawlX SKILL.md | PLANNED | 1–6 | — |
| 9 | Change tracking + scheduled recrawls | PLANNED | 1, 2 | — |

## Legend
- ⚪ **PLANNED**: Ready for implementation.
- 🔵 **ACTIVE**: Implementation in progress.
- 🟢 **COMPLETED**: Verified and committed.
- 🟡 **BLOCKED**: Waiting on dependency.
- 🔴 **FAILED**: Requires remediation.

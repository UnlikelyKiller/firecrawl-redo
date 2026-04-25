# Specification: Track 6 - Agent Lite + Search + Webhooks + Handoff Flows

## Overview

Track 6 plans CrawlX's bounded agent system. The updated plan adds one important extension: the agent may need to operate with an external authenticated session and hand off to an operator without losing profile ownership or auditability.

## Deliverables

- bounded agent loop plan
- webhook delivery plan
- human handoff/resume plan
- auditability and budget-control plan

## Acceptance Criteria

- the agent remains bounded by budgets and domain policy
- webhook semantics are explicit
- human handoff works with named profiles and lease ownership rules

## Dependencies

- Track 3
- Track 3a
- Track 4
- Track 5

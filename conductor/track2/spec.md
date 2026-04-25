# Specification: Track 2 - Job Durability + Replay + Artifacts Refresh

## Overview

Track 2 ensures CrawlX keeps a durable and replayable record of every job, attempt, and artifact pointer. The updated plan adds one important concern: replay and artifact retrieval must remain correct even when later tracks introduce external browser backends and named profiles.

## Deliverables

- durable job persistence planning
- replay lineage planning
- artifact retrieval planning
- attempt and usage metering integration planning

## Acceptance Criteria

- replay semantics are explicit for ordinary jobs and future external-session jobs
- artifact retrieval planning covers all stored receipt types
- attempt-level history remains reconstructable for audit and dashboard use

## Dependencies

- Track 1

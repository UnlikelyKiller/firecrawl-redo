# Specification: Track 1 - Firecrawl v2 Compatibility + Durable Jobs Refresh

## Overview

Track 1 keeps CrawlX's `/v2/*` surface coherent while preserving durable jobs and content-addressed artifact references. This track is not where Tandem or profile identity are implemented, but it must leave the job and artifact model ready for them.

## Deliverables

- reviewed and pinned `/v2/*` request/response schemas
- durable job lifecycle planning
- artifact pointer planning for all major receipt types
- queue/status contract planning for API and CLI

## Acceptance Criteria

- `/v2/*` compatibility expectations are documented
- durable job states remain the source of truth regardless of backend choice
- later tracks can attach extra engine and receipt metadata without breaking core job contracts

## Dependencies

- Track 0

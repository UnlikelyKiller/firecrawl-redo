# Specification: Track 3 - Waterfall Engine + Browser Worker + Receipts Refresh

## Overview

Track 3 plans the ordinary CrawlX browser and waterfall path:

- local Playwright execution
- branded-browser mode
- recipe execution
- receipt capture
- manual-review fallback

This track explicitly does not own profile identity or external browser backend policy. That work is split into Track 3a.

## Deliverables

- updated engine ladder planning
- browser-worker receipt planning
- recipe sandbox planning
- waterfall test and failure-taxonomy planning

## Acceptance Criteria

- each engine has a clear role in the ladder
- receipt expectations are explicit and capability-gated
- Track 3 can stand alone without requiring external browser backends

## Dependencies

- Track 1
- Track 2

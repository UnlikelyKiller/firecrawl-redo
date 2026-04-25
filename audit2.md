# Audit 2

## Summary

This pass confirms that several items from the previous audit were addressed at the file-structure level:

- CrawlX route files now exist under `apps/api/src/routes/crawlx/v2/`.
- Additional DB schema files now exist, including `page_snapshots` and `policy_decisions`.
- Additional waterfall engine classes now exist and are exported.
- CLI `agent` and `watch` no longer advertise `501 Not Implemented`.

Those fixes are not yet sufficient to call the implementation complete. The highest-risk issues now are integration correctness, API build breakage, schema/route mismatches, and placeholder implementations that return synthetic success instead of performing the planned behavior.

## Findings

### High

1. `apps/api` still does not build, so the new CrawlX API surface is not in a shippable state. Running `pnpm --dir apps/api build` fails with unresolved module/type errors for the new CrawlX additions, including `src/lib/db.ts`, `src/middleware/activity-logger.ts`, and the new `src/routes/crawlx/v2/*` files. The build output specifically reports unresolved imports for `drizzle-orm/node-postgres`, `@crawlx/db`, `@crawlx/waterfall-engine`, and `@crawlx/model-adapter`. A conductor board that still marks Tracks 3-9 complete (`conductor/conductor.md:10-19`) is not credible while the API app fails to compile.

2. Several new CrawlX routes are wired against schema fields that do not exist in the DB definitions, which makes them effectively broken even before runtime verification. `apps/api/src/routes/crawlx/v2/watch.ts:18-25` inserts `checkInterval`, `active`, `lastCheckAt`, and `nextCheckAt`, but `packages/db/src/schema/watch-jobs.ts:3-8` only defines `id`, `url`, `interval`, and `lastRunAt`. `apps/api/src/routes/crawlx/v2/webhooks.ts:11`, `apps/api/src/routes/crawlx/v2/webhooks.ts:26-31` use `createdAt`, `eventTypes`, and `active`, but `packages/db/src/schema/webhook-subscriptions.ts:3-8` only defines `id`, `url`, `events`, and `secret`. `apps/api/src/routes/crawlx/v2/extract.ts:42-50` inserts `tokensIn`, `tokensOut`, and `correlationId`, but `packages/db/src/schema/llm_calls.ts:3-16` defines `promptTokens`, `completionTokens`, `provider`, `request`, and `response` instead.

3. The new Agent and Extract routes do not meet the plan requirements and still contain functional gaps large enough to block a “complete” claim. `apps/api/src/routes/crawlx/v2/agent.ts:72-74` explicitly says “For now, skip search and just scrape the provided URL,” which falls short of the planned agent loop. It also validates requests with `ExtractRequestSchema` instead of a dedicated agent schema (`apps/api/src/routes/crawlx/v2/agent.ts:60`), and passes `req.body.schema || {}` into the extraction pipeline (`apps/api/src/routes/crawlx/v2/agent.ts:91`) rather than a validated Zod schema. `apps/api/src/routes/crawlx/v2/extract.ts:124-128` constructs `new ExtractionPipeline(modelRouter, logger)` even though the pipeline constructor takes options, not a logger object, and then calls `pipeline.extract(..., z.any(), { jobId })`, ignoring the user-provided schema parsed at `apps/api/src/routes/crawlx/v2/extract.ts:94`.

4. The added waterfall engines are still placeholder implementations that return synthetic success bodies instead of actually performing the planned work. `packages/waterfall-engine/src/engines/firecrawl-cloud.ts:13-20`, `packages/waterfall-engine/src/engines/manual-review.ts:13-20`, and `packages/waterfall-engine/src/engines/crawlx-branded-browser.ts:13-20` all return hard-coded HTML immediately. This resolves the earlier “missing class” finding only cosmetically; it does not satisfy the plan’s requirement for functioning engines.

### Medium

5. Browser receipt support improved, but it is still not robust enough to count as verified completion. `apps/browser-worker/src/artifact-capture.ts:115-140` now attempts HAR and video capture, which is an improvement over the prior state, but both branches are best-effort and silently degrade with `console.warn`. The HAR path depends on `context.har?.export()` (`apps/browser-worker/src/artifact-capture.ts:120`), which is not guaranteed by the rest of the worker setup shown here, so this still needs end-to-end verification rather than a file-presence check.

6. The dashboard remains mock-backed rather than live. `apps/web/src/pages/JobsPage.tsx:5-57`, `apps/web/src/pages/UsagePage.tsx:3-53`, and `apps/web/src/pages/ActivityPage.tsx:4-59` still render hard-coded `MOCK_*` datasets. That means the prior “dashboard is mock-only” finding is still open, even though backend route files now exist.

7. Some prior findings were fixed only partially. The CLI commands no longer claim `501` and now post to CrawlX endpoints (`apps/cli/src/commands/agent.ts:7-33`, `apps/cli/src/commands/watch.ts:7-37`), and the conductor still claims all tracks are complete (`conductor/conductor.md:10-19`). But those CLI commands now depend on new backend routes that are not yet verified working and, in several cases, are inconsistent with the DB schema and API build status above.

## Regressions

1. The change set introduces new build-surface failures in `apps/api` by adding route and DB integration code that the app cannot currently compile. This is worse than the earlier state where some capabilities were simply absent but did not widen the app’s compile failure surface.

2. The new route layer increases the mismatch between conductor status and actual verification. The board still says everything is verified complete (`conductor/conductor.md:10-19`), but this revision adds more code paths that are clearly scaffold-level or non-functional, which makes that status less accurate, not more.

## Verification Performed

- Read the updated conductor board and the newly added CrawlX route/schema/engine files.
- Verified app mounting in `apps/api/src/index.ts` and route registration in `apps/api/src/routes/crawlx/v2/index.ts`.
- Ran package-level checks:
  - `pnpm --filter @crawlx/db --filter @crawlx/firecrawl-compat --filter @crawlx/security --filter @crawlx/waterfall-engine --filter @crawlx/model-adapter typecheck`
  - Result: passed.
- Ran app-level checks:
  - `pnpm --filter @crawlx/cli typecheck`
  - `pnpm --filter @crawlx/web typecheck`
  - `pnpm --filter @crawlx/browser-worker test`
  - Result: passed.
- Ran API checks:
  - `pnpm --dir apps/api build`
  - Result: failed with unresolved module/type errors, including the new CrawlX integration files.
  - `pnpm --dir apps/api test -- --runInBand`
  - Result: failed broadly. Some failures appear pre-existing or environment-dependent, but the suite also reports type/module issues that block confidence in the new API layer.

## Conclusion

The repo is closer than the previous audit: several missing files now exist, and some obvious placeholders were removed from the CLI. The implementation is still not in a state where “everything’s been addressed” is defensible. The main remaining blockers are broken API build integration, route/schema mismatches, placeholder engine behavior, and a dashboard that is still entirely mock-backed.

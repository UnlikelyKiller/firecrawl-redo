# Track 13: Windows Tandem & Waterfall Hardening

## Objective
Switch to Windows-native Tandem, resolve identified "leaks", and complete the waterfall engine implementations.

## Deliverables
- [x] **Task 13.1: Windows Tandem Switchover**
    - Update `TandemBrowserEngine` to target the Windows-native instance at `C:\dev\tandem`.
    - Adjust networking for Windows host access (e.g., `host.docker.internal` or direct `localhost`).
- [x] **Task 13.2: Tandem Leak Fixes**
    - Implement stability fixes identified during earlier Ubuntu/WSL testing.
    - Ensure proper cleanup of browser instances on Windows.
- [x] **Task 13.3: Recipe Engine Implementation**
    - Update `crawlx-recipe.ts` to execute real recipe steps via the `RecipeRunner`.
- [x] **Task 13.4: Branded Browser Implementation**
    - Update `crawlx-branded-browser.ts` to correctly instantiate Playwright sessions with extensions.
- [x] **Task 13.5: Manual Review Queue**
    - Update `manual-review.ts` to persist pending review records in the DB.
- [x] **Task 13.6: Wire Tandem into API** (Added)
    - Add Tandem as a high-quality engine in the API scraping pipeline.

## Verification
- [x] `pnpm --filter "@crawlx/waterfall-engine" run test`
- [x] Manual test: Scrape a URL using the Windows Tandem engine.
- [x] Verify no orphan Tandem processes remain after job completion.

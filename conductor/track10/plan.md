## Plan: Track 10 - Audit Response + Tandem Real Integration

### Phase 1: Audit Response — Policy and Worker Fixes
- [x] Task 1.1: Add Tandem engine path to `buildEngines()` in `packages/jobs/src/worker.ts` — Tandem checked before Multilogin as preferred external backend.
- [x] Task 1.2: Extend `packages/policy/src/engine.ts` with `tandem_required` browserMode, `tandem` sessionBackend, `external_backend_denied`, `human_session_required`, `operator_handoff_required` decisions.
- [x] Task 1.3: Extend domain policy API (`apps/api/src/routes/crawlx/v2/domains.ts`) to expose and accept `allows_external_browser_backend`, `requires_human_session`, `requires_operator_handoff` in all CRUD handlers.

### Phase 2: Tandem Real Integration
- [x] Task 2.1: Investigate actual Tandem Browser API by reading source (`src/api/routes/browser.ts`, `tabs.ts`, `content.ts`, `server.ts`) and docs (`skill/SKILL.md`, `docs/api-current.md`).
- [x] Task 2.2: Rewrite `TandemBrowserEngine` to use real HTTP flow: `GET /status` → `POST /tabs/open` → `POST /wait` → `GET /page-content` → `GET /page-html` → `POST /tabs/close`.
- [x] Task 2.3: Update auth from `x-tandem-secret` header to `Authorization: Bearer <token>`.
- [x] Task 2.4: Strip fake options (`tandemProfileId`, `workerId`, `connectOverCdp`) from `TandemBrowserEngineOptions`.
- [x] Task 2.5: Rewrite 14 tests covering all real API paths, error mappings, domain allowlist, and default baseUrl.
- [x] Task 2.6: Simplify `TandemEligibilityResult` in `worker.ts` — remove `lease`, `releaseLease`, `tandemProfileId`, `profileId` fields.
- [x] Task 2.7: Rewrite ADR-0002 to accurately describe real Tandem HTTP API and integration approach.

### Phase 3: WSL Installation and Verification
- [x] Task 3.1: Clone `hydro13/tandem-browser` into WSL Ubuntu at `~/tandem-browser`.
- [x] Task 3.2: Run `npm install` (builds native modules, downloads Electron 40.x linux-x64).
- [x] Task 3.3: Run `npm run build` — produces `release/linux-unpacked/` and AppImage.
- [x] Task 3.4: Verify Tandem starts with Xvfb on `:99` and serves HTTP on `127.0.0.1:8765`.
- [x] Task 3.5: Run end-to-end scrape test: open tab for `example.com`, wait, read page-content, read page-html, close tab — all steps verified.

### Phase 4: Documentation
- [x] Task 4.1: Create `conductor/track10/spec.md` and `conductor/track10/plan.md`.
- [x] Task 4.2: Update `conductor/conductor.md` to add Track 10.
- [x] Task 4.3: Mark `conductor/track3a/plan.md` tasks as completed.
- [x] Task 4.4: Add implementation status section to `tandem-plan.md` and `tandem-implementation-plan.md`.

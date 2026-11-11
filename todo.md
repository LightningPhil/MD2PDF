# TODO - Project Implementation

## Public MIT release and GitHub Pages

- [x] Verify repository visibility, MIT ownership and Pages settings.
- [x] Complete dependency/font notices and expose them in the app.
- [ ] Run release checks and deploy the current editor to GitHub Pages.
- [ ] Verify the deployed site and downloadable license notices.

Release checks: 132 unit tests, TypeScript, the full workspace browser suite, Pages subpath browser suite (including license downloads), production Pages build and audit traceability pass. Runtime dependency audit reports zero known vulnerabilities. Notices cover 18 installed runtime packages plus KaTeX fonts and Pako's Zlib code. Deployment and live verification remain pending.

## [CMD:live-use-case-campaign] Browser acceptance and repairs

- [x] Launch a dedicated tab on an OS-assigned random local port.
- [x] Exercise representative paths for all 39 stories and record unverified variants explicitly.
- [x] Fix observed defects and rerun affected browser workflows.
- [ ] Inspect generated PDFs and native print/save/cancel behaviour.
- [x] Run available release checks and refresh traceability and live evidence.

Results: [live review](docs/LIVE_REVIEW.md). Saved-style inheritance, insertion cursor, file-list focus and Windows Vite fixture watching repaired; rename/close use in-app dialogs. 132 tests, typecheck, both builds and dependency audit pass. Native print control was unavailable, so no new PDF pass is claimed. The separate CLI browser suites, physical drag/drop/pan, screen-reader/touch and forced storage failures remain listed acceptance work.

The user has now authorized browser interaction and app launch. Use test documents in the dedicated origin; leave other applications and tabs alone.

## [CMD:use-case-code-review] Code review and repairs without launching the app

- [x] Review all 39 stories and record a code-level verdict for each.
- [x] Repair rendering safety, literal text, draft closure, and per-document undo.
- [x] Repair table captions, image/table round trips, layout isolation, and responsive/keyboard access.
- [x] Make diagnostics and export gating accurate, and improve resource/error handling.
- [x] Add meaningful non-browser regressions; restore coverage reporting and release checks.
- [x] Run unit tests, typecheck, builds, and traceability validation only.
- [x] Update current guidance, audit status, and the deferred live-test checklist.

Constraint observed: no dev/preview server, application, browser/E2E suite or browser probe was launched during this review.

Results: [39-story code review](docs/CODE_REVIEW.md); 128 unit/component tests passed; measured statement coverage 54.89%; typecheck and both builds passed; npm audit reports zero known vulnerabilities. Current function/feature/file associations pass validation. [Live acceptance](MANUAL_TESTING.md) remains deferred, including final PDF appearance, native print, MathLive and responsive/keyboard behaviour.

## [CMD:audit-use-cases] Short document audit on 6 November 2026

- [x] Inspect current implementation, earlier plans, tests, and release workflow.
- [x] Run typecheck, unit tests, browser suites, and Pages production build.
- [x] Reproduce functional and safety gaps and inspect generated PDF samples.
- [x] Write engineering, report-conversion, and academic use cases with user stories.
- [x] Map every capability, source function, and supporting repository file to use cases.
- [x] Validate coverage links and record findings, limitations, and release priorities.

Historical baseline task: this recorded the original software. The code-review task above subsequently repaired findings; its evidence and limitations are in [CODE_REVIEW.md](docs/CODE_REVIEW.md).

Historical baseline results (superseded by the code review above): [audit](docs/AUDIT.md), [39 use cases](docs/USE_CASES.md), [130 capability groups](docs/FEATURE_COVERAGE.md), and [function coverage](docs/FUNCTION_COVERAGE.md). The coverage validator reports 520 application callables, 721 total first-party callables, 78 repository files, and zero unmapped or invalid associations. Typecheck, 89 unit tests, both browser suites, and the Pages build passed. The coverage command fails because `@vitest/coverage-v8` is missing. Twelve findings remain for implementation follow-up.

## [CMD:git-initial-commit] Tasks - COMPLETED
- [x] Initialize git repository
- [x] Create .gitignore with Node template patterns
- [x] Create .gitattributes with safe baseline
- [x] Stage all files safely (excluding forbidden patterns)
- [x] Create initial commit with configured message
- [x] Report next steps for remote setup

## [CMD:audit-implementation] Tasks - BOOTSTRAP MODE - COMPLETED

**Core Requirements from ProjectPlan.md:**
- [x] BOOTSTRAP: Set up project structure (/src, package.json, index.html)
- [x] REQ-UI: Split-pane UI (Markdown editor left, A4 preview right)  
- [x] REQ-EDITOR: Live markdown editing with preview updates
- [x] REQ-MATH: KaTeX math rendering with HTML/SVG toggle
- [x] REQ-PAGES: A4-sized pages with proper pagination
- [x] REQ-FILES: File upload/download (.md files)
- [x] REQ-BREAKS: Clean page breaks (no mid-equation/table splits)

**Milestones:**
- [x] M1: Editor + Live Preview  
- [x] M2: Pagination
- [x] M3: File Handling
- [x] M4: SVG/HTML Toggle

**Verification Steps:**
- [x] Install dependencies (npm install)
- [x] Test development server (npm run dev) - ✅ Running on http://localhost:3000
- [x] Verify TypeScript compilation (npm run typecheck) - ✅ No errors
- [x] Fix VS Code problems - ✅ Only minor accessibility warning fixed
- [x] Create README.md - ✅ Complete

**Acceptance:** ✅ ALL COMPLETE
- ✅ Markdown edits live-update preview
- ✅ A4 layout with proper page styling  
- ✅ Equations render correctly with KaTeX
- ✅ No half-equation breaks (smart pagination)
- ✅ Upload/save functionality works
- ✅ Math mode toggle (HTML/SVG) implemented

## [CMD:todonow-prd] Tasks - COMPLETE

- [x] TASK-001: Fix Accessibility Warning (aria-label on file input)
- [x] TASK-002: Create Test Infrastructure (Vitest + happy-dom)
- [x] TASK-003: Write Core Feature Tests (54 tests passing)
- [x] TASK-005: Create Manual Test Plan Docs (MANUAL_TESTING.md)
- [x] TASK-006: Production Build Verification (dist/ confirmed)
- [x] Polish Documentation (README updated with testing info)

# MD2PDF Architecture Audit - Report 4

**Date:** February 13, 2026  
**Role:** Senior Software Architect Review  
**Scope:** Verify `audit_report3.md` implementation status, re-assess current architecture and test posture, and recommend next improvements.

---

## 1. Validation Summary

I validated both the code and the quality pipeline.

### Commands executed
- `pnpm test -- --run` -> **41 tests passed**
- `pnpm run typecheck` -> **passed**
- `pnpm build` -> **passed**
- `npm test -- --run` -> **passed** (after sandbox elevation)
- `npm run typecheck` -> **passed**
- `npm run build` -> **passed** (after sandbox elevation)
- `npm ci --dry-run` -> **passes dry-run**

### Current health snapshot
- Functional baseline is stable.
- Build remains large (`~1.44 MB` main JS chunk warning from Vite).
- No regressions found in current test suite.

---

## 2. Audit 3 Recommendation Verification

## R1: Remove/Isolate legacy source-mapping logic  
**Status:** `Not Implemented`

Evidence:
- Still exported in `src/source-mapping/resolver.ts:134` (`resolveBestSourceMapping`)
- Still exported in `src/source-mapping/resolver.ts:217` (`deriveSourceMappingFromRenderedLines`)
- Active runtime only uses `normalizeSourceMapping` + `deriveSourceMappingFromSourceSpans`:
  - `src/source-mapping/index.ts:2`
  - `src/typesetter.ts:18`

---

## R2: Deduplicate page-size domain model  
**Status:** `Implemented`

Evidence:
- `src/typesetter.ts` now imports from `src/types/page.ts`
- Duplicate inline `PageSizeKey/PageSizeSpec/PAGE_SIZES` removed from `src/typesetter.ts`

---

## R3: Batch settings updates to avoid multi-render churn  
**Status:** `Partially Implemented`

Evidence:
- Added `PageManager.updateConfig(...)` in `src/pages.ts:308`
- Main now uses batched setter path in `src/main.ts:177`
- But settings handler still does explicit extra full re-render:
  - `src/main.ts:102` -> `this.applySettings();`
  - `src/main.ts:103` -> `this.renderActiveDocument();`

Impact:
- Render churn is reduced but not fully eliminated.

---

## R4: Unify typography source of truth (toolbar + settings modal)  
**Status:** `Partially Implemented`

Evidence:
- One-way sync added from settings modal to toolbar:
  - `src/main.ts:134`
  - `src/ui.ts:322`
- Still dual control surfaces:
  - toolbar font select (`index.html:40`, `src/ui.ts:314`)
  - settings base font pt (`index.html:537`, `src/main.ts:116`)

Gap:
- No robust two-way state model; only best-effort UI syncing.

---

## R5: Remove unused DocumentService EventEmitter  
**Status:** `Implemented`

Evidence:
- EventEmitter removed from `src/services/document-service.ts`
- `DocumentServiceEvents` export removed from `src/services/index.ts`

---

## R6: Clarify filename utility ownership  
**Status:** `Not Implemented`

Evidence:
- Domain filename logic exists in `src/services/document-service.ts:276`
- Similar utility helpers still exist in `src/utils/format.ts:24`

---

## R7: Fix README drift  
**Status:** `Implemented`

Evidence:
- Removed stale "Math toggle" instruction
- Replaced with Settings/Header-Footer usage in `README.md:64`

---

## R8: Expand tests for controllers/modals/services  
**Status:** `Not Implemented`

Evidence:
- Tests remain only:
  - `tests/editor.test.ts`
  - `tests/pages.test.ts`
  - `tests/typesetter-options.test.ts`
  - `tests/typesetter-source-mapping.test.ts`

---

## R9: Add CI workflow  
**Status:** `Implemented`

Evidence:
- Added `.github/workflows/ci.yml`
- Runs install/typecheck/test/build on Node `18` and `20`

---

## R10: Dependency hygiene cleanup  
**Status:** `Partially Implemented`

Evidence:
- Removed from `package.json`: `@testing-library/dom`, `jsdom`
- But `package-lock.json` still contains those top-level entries (`package-lock.json:18`, `package-lock.json:21`)

Risk:
- Lockfile drift and reduced determinism for CI/local parity.

---

## R11: Break up monolithic engine files  
**Status:** `Not Implemented`

Evidence:
- `src/typesetter-engine/layout/engine.ts` remains ~2540 lines
- `src/typesetter-engine/math/layout.ts` remains ~1199 lines
- `src/source-mapping/resolver.ts` remains ~1134 lines

---

## 3. New/Updated Architecture Findings

## A. Render-path duplication still present (High)

The batched config update is good, but `onSettingsChange` still calls `renderActiveDocument()` after `updateConfig()`. This likely causes redundant active-document work under frequent setting changes.

Evidence:
- `src/main.ts:102`
- `src/main.ts:103`
- `src/main.ts:177`

Recommendation:
- Make settings changes go through one render pipeline only.
- Add an explicit "settings update completed" callback from PageManager if page-count refresh depends on completion.

---

## B. Typography synchronization is still not deterministic (High)

Current sync is partial and constrained by toolbar option values. If converted pt value does not match a toolbar option, sync silently does nothing.

Evidence:
- `src/ui.ts:324`

Recommendation:
- Introduce single canonical typography state object.
- Either remove toolbar font select, or bind both controls to shared state with deterministic conversion/rounding policy.

---

## C. Source-mapping module still carries significant dead/legacy complexity (High)

Even after earlier improvements, the resolver keeps multiple historical strategies that are not active in runtime integration. This is a maintainability and refactor-risk hotspot.

Recommendation:
- Split active and legacy mapping paths into separate files.
- Keep only active exports in `source-mapping/index.ts`.

---

## D. Package management consistency needs finishing (Medium)

Repository currently has only `package-lock.json`, no `pnpm-lock.yaml`, while team workflows have frequently used `pnpm`.

Evidence:
- `pnpm-lock.yaml` missing
- `package-lock.json` present
- CI uses npm (`.github/workflows/ci.yml:28`)

Recommendation:
- Standardize on one package manager.
- If npm is canonical: always update and commit `package-lock.json` with dependency changes.

---

## E. Test surface area remains narrow versus architecture surface (Medium)

High-change modules still have no direct tests:
- `src/ui.ts`
- `src/controllers/PreviewController.ts`
- `src/modals/SettingsModal.ts`
- `src/services/document-service.ts`

Recommendation:
- Add focused unit tests and light integration tests around orchestration flows.

---

## F. Quality gate maturity is still below world-class (Medium)

No linting or formatting gates, and coverage has no thresholds.

Evidence:
- No `lint`/`format` scripts in `package.json`
- No coverage thresholds in `vitest.config.ts`

Recommendation:
- Add ESLint + Prettier.
- Add coverage thresholds (start realistic, raise progressively).

---

## G. Export/page-count architecture can scale better (Medium)

`recomputeInactivePageCounts()` iterates docs sequentially and computes page counts one-by-one using shared PageManager path.

Evidence:
- `src/main.ts:339`
- `src/main.ts:343`
- `src/main.ts:348`

Recommendation:
- Move page-count estimation into a dedicated stateless typeset service path.
- Support controlled concurrency for inactive-document page counts.

---

## H. Minor maintainability/UI debt (Low-Medium)

1. `window.prompt` rename UX is brittle (`src/ui.ts:454`)
2. Notification rendering uses inline `style.cssText` (`src/ui.ts:522`)
3. Document IDs use `Date.now() + Math.random()` (`src/services/document-service.ts:315`)

Recommendations:
- Replace prompt with modal-based rename input.
- Move toast styling to CSS class system.
- Use `crypto.randomUUID()` where available.

---

## 4. Recommended Roadmap (Next Iteration)

## Phase 1 - Correctness + Determinism (1-2 days)
1. Remove render duplication in settings flow.
2. Implement canonical typography state; finalize two-way sync.
3. Resolve lockfile drift and package-manager policy.

## Phase 2 - Maintainability Hotspots (2-4 days)
1. Split `source-mapping/resolver.ts` into active vs legacy modules.
2. Consolidate filename utility ownership to one module boundary.
3. Add tests for `DocumentService`, `SettingsModal`, and `PreviewController`.

## Phase 3 - Engineering Quality Hardening (2-3 days)
1. Add ESLint + Prettier and CI enforcement.
2. Add coverage thresholds in Vitest config.
3. Create a small architecture decision record documenting package manager, typography state model, and source-mapping strategy.

## Phase 4 - Performance and UX (optional, high value) (3-5 days)
1. Reduce bundle size with code splitting (help modal content, optional modules).
2. Improve export/page-count pipeline isolation to avoid UI side effects and improve throughput.
3. Replace prompt-driven actions with modal-based UX components.

---

## 5. Final Assessment

The team made meaningful progress on `audit_report3` recommendations. The codebase is stable and improving.  
The next step is to finish the partially implemented architectural shifts (render determinism, typography state ownership, source-mapping simplification) and raise quality gates (lint/coverage/package consistency). That combination will materially improve long-term maintainability and release confidence.

# MD2PDF Architecture & Maintainability Audit (Report 3)

**Date:** February 13, 2026  
**Scope:** Full repository review after prior refactors (`audit_results.md`, `audit_results2.md`)  
**Goal:** Identify what still blocks a "world-class" maintainable codebase and provide a pragmatic improvement plan.

---

## Executive Summary

The codebase is in a materially better state than the earlier audits: modularization happened, tests are green, and build succeeds.

Current verification status:
- `pnpm test -- --run`: **41 passing tests**
- `pnpm build`: **passes** (`tsc` + Vite build)

However, there are still several high-value cleanup items:
1. Legacy/dead source-mapping logic remains in production code and is now mostly unused.
2. Some architectural layers are only partially adopted (event bus, shared types, utility ownership).
3. UI typography controls have overlapping responsibilities and are easy to drift.
4. Tooling/quality gates (CI, linting, coverage thresholds) are still below world-class standards.

---

## Findings (Prioritized)

## 1) Legacy Source-Mapping Logic Still Present (High)

**Evidence**
- `src/source-mapping/resolver.ts:134` exports `resolveBestSourceMapping`
- `src/source-mapping/resolver.ts:217` exports `deriveSourceMappingFromRenderedLines`
- Current runtime path only imports:
  - `normalizeSourceMapping` and `deriveSourceMappingFromSourceSpans` via `src/source-mapping/index.ts:2`
  - `src/typesetter.ts:18`

**Why it matters**
- Large dormant logic increases cognitive load and regression risk.
- It obscures the now-simpler "typesetter emits mapping directly" model.

**Recommendation**
- Split `resolver.ts` into:
  - `source-mapping/normalize.ts` (active)
  - `source-mapping/source-span-fallback.ts` (active)
  - `source-mapping/legacy-rendered-line.ts` (archive or remove)
- Remove unused exports from the active index.

---

## 2) Duplicate Page Size Domain Model (High)

**Evidence**
- Shared definition exists in `src/types/page.ts:6`
- Duplicate definitions remain in `src/typesetter.ts:23`

**Why it matters**
- Domain constants/types can diverge silently.
- Cross-module changes become error-prone.

**Recommendation**
- Make `src/types/page.ts` the single source of truth.
- Refactor `src/typesetter.ts` to import `PageSizeKey`, `PageSizeSpec`, and `PAGE_SIZES` instead of redeclaring.

---

## 3) Settings Flow Can Trigger Redundant Re-Render Work (High)

**Evidence**
- `src/main.ts:101` (`onSettingsChange`) calls both:
  - `applySettings()` and
  - `renderActiveDocument()`
- `applySettings()` calls setters in `PageManager`:
  - `src/main.ts:171`..`src/main.ts:174`
- Each setter can render independently:
  - `src/pages.ts:133`, `src/pages.ts:143`, `src/pages.ts:153`, `src/pages.ts:290`

**Why it matters**
- Extra render passes can stack under interactive changes and large docs.
- Harder to reason about render causality and performance.

**Recommendation**
- Add a single `PageManager.updateRenderConfig(...)` method that batches mutations and renders once.
- In `main.ts`, use one render trigger per user action.

---

## 4) Typography Controls Have Overlapping Sources of Truth (High)

**Evidence**
- Toolbar font size control (px): `index.html:40`, `src/ui.ts:315`
- Settings modal base font (pt): `index.html:537`, `src/main.ts:115`

**Why it matters**
- Users can set conflicting values through different controls.
- Future contributors need to understand two typography pipelines.

**Recommendation**
- Define one canonical typography state object in app state.
- Either:
  1. keep a single UI control set, or
  2. keep both controls but bidirectionally synchronize with explicit conversion (px <-> pt) and conflict rules.

---

## 5) DocumentService EventEmitter Is Unused Externally (Medium)

**Evidence**
- Emitter exists: `src/services/document-service.ts:54`
- No consumer usage found in `main.ts`/`ui.ts`.

**Why it matters**
- Adds complexity without value.
- Gives false signal that service is reactive when orchestration is direct method calls.

**Recommendation**
- Either wire it into orchestration properly or remove it and keep the service purely imperative.

---

## 6) Utility Ownership Is Still Blurry (Medium)

**Evidence**
- `src/utils/format.ts` exports filename helpers.
- Similar filename logic also lives in `src/services/document-service.ts:309` and `src/services/document-service.ts:325`.

**Why it matters**
- Duplicate logic tends to drift.
- Harder to know which API is authoritative.

**Recommendation**
- Choose one owner for filename normalization rules:
  - Prefer `DocumentService` for domain behavior.
  - Keep `utils/format.ts` focused on generic formatting (e.g., durations), or remove duplicate exports.

---

## 7) Documentation Drift Still Exists (Medium)

**Evidence**
- README still references removed behavior:
  - `README.md:64` ("Use `Math` toggle to switch between render modes.")

**Why it matters**
- Misleads users and contributors.
- Reduces confidence in docs as source of truth.

**Recommendation**
- Refresh README usage section to match the actual UI and controls.
- Add doc checks to PR checklist.

---

## 8) Testing Strategy Gaps (Medium)

**Evidence**
- Test include is limited to `tests/**/*.test.ts`: `vitest.config.ts:7`
- No tests currently target:
  - `UIController`
  - modal classes
  - controller modules (`PreviewController`, `SidebarController`, `ThemeController`)
  - `DocumentService`

**Why it matters**
- Highest-change surface areas are under-tested.
- Refactors carry higher regression risk than necessary.

**Recommendation**
- Add focused unit suites for:
  - `document-service.test.ts`
  - `settings-modal.test.ts`
  - `preview-controller.test.ts`
- Add integration tests for `main.ts` orchestration with mocked services.

---

## 9) No CI Workflow in Repository (Medium)

**Evidence**
- No `.github/workflows` directory exists.

**Why it matters**
- Quality checks depend on manual local runs.
- Regressions can slip in silently.

**Recommendation**
- Add CI with required checks:
  - `pnpm install`
  - `pnpm run typecheck`
  - `pnpm test -- --run`
  - `pnpm build`

---

## 10) Dependency Hygiene: Likely Unused Dev Dependencies (Low-Medium)

**Evidence**
- `package.json` includes `jsdom` and `@testing-library/dom`
- Tests currently use `happy-dom` (`vitest.config.ts:5`)
- No direct references found in `src/` or `tests/`.

**Why it matters**
- Increases install surface and maintenance overhead.

**Recommendation**
- Remove unused dependencies or add usage-backed tests if intentionally retained.

---

## 11) Large Monolithic Engine Files Are a Future Risk (Low-Medium)

**Evidence**
- `src/typesetter-engine/layout/engine.ts` (~2540 lines)
- `src/typesetter-engine/math/layout.ts` (~1199 lines)

**Why it matters**
- Harder onboarding and safe refactoring.
- Increases merge conflict frequency.

**Recommendation**
- Split by domain units (paragraph/list/table/header-footer, math environments/operators).
- Keep core types in shared modules and enforce file-size guardrails.

---

## Completed In This Pass

1. Default table font size updated to `10`:
   - `src/modals/SettingsModal.ts`
   - `index.html` (`settingsTableFontSize` default value)
2. Regression safety retained (tests and build validated).

---

## Suggested Implementation Roadmap

## Phase A (Fast, low risk)
1. Remove/update stale README content.
2. Prune unused dependencies.
3. Remove or wire unused `DocumentService.events`.
4. Deduplicate page size definitions (`types/page.ts` as source of truth).

## Phase B (Medium effort, high payoff)
1. Simplify source-mapping module surface and isolate legacy path.
2. Unify typography state model (toolbar + settings).
3. Batch PageManager config updates to single-render transactions.

## Phase C (Quality hardening)
1. Add CI workflow with required checks.
2. Add missing tests for controllers/modals/services.
3. Introduce linting/format guardrails (ESLint + Prettier) for consistency.

---

## Final Assessment

The project is close to a very strong maintainable baseline. The remaining work is mostly **structural polish and quality gate maturity**, not foundational re-architecture. Addressing the high-priority items above will significantly reduce future regression risk and make ongoing feature work much faster and cleaner.

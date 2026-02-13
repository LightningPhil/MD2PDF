# MD2PDF Architecture Audit - Phase 2

**Date:** February 2026  
**Auditor:** Senior Software Architect Analysis  
**Scope:** Source mapping reliability, bi-directional sync, and typesetter integration

---

## Executive Summary

The bidirectional source mapping between the markdown editor and the preview canvas exhibits significant drift after certain content types, particularly tables. The root cause is an over-complicated heuristic-based mapping system that attempts to reverse-engineer source positions from rendered text, rather than tracking them directly during the layout phase.

### Key Issues Identified

1. **Source Mapping Architecture is Overly Complex (~1,300 lines)**
   - Three fallback strategies with fuzzy text matching
   - Heuristic role detection that fails on tables and math
   - Text similarity scoring that cannot handle multi-cell layouts

2. **Tables Cause Cumulative Drift**
   - Table cells are laid out in visual grid order, not source line order
   - The text-matching algorithm confuses cells across rows
   - No structural awareness of table boundaries

3. **canvadoc-typesetter Integration is Partial**
   - The typesetter already emits `sourceSpan` on every `DrawOp`
   - This data is available but underutilized
   - The mapping derivation happens post-hoc instead of during layout

4. **Naming Inconsistency**
   - The package is named `canvadoc-typesetter` internally but integrated into `src/`
   - References are mixed between the internal module and external-style imports

---

## Current Source Mapping Flow (Problematic)

```
Markdown → Typesetter.typeset() → PageLayout[] with DrawOps (each has sourceSpan)
                                         ↓
                           ┌─────────────┴─────────────┐
                           │   source-mapping/resolver.ts (~1,300 lines)
                           │                           │
                           │  Strategy 1: Use provided mapping (rarely available)
                           │  Strategy 2: Derive from sourceSpan on ops (partial)
                           │  Strategy 3: Match rendered text to source (heuristic)
                           │                           │
                           │  → Merge strategies       │
                           │  → Interpolate gaps       │
                           │  → Build line boxes       │
                           └───────────────────────────┘
                                         ↓
                           SourceMappingEntry[] (often inaccurate)
                                         ↓
                           pages.ts: sourceLineBoxes (used for sync)
```

### Why This Fails

**Text Matching Cannot Handle Tables:**
```markdown
| A | B | C |            ← Source line 5
|---|---|---|
| 1 | 2 | 3 |            ← Source line 7
| 4 | 5 | 6 |            ← Source line 8
```

The rendered text might concatenate as "A B C 1 2 3 4 5 6" in visual order, but the matching algorithm doesn't know that "1" comes from line 7, column 1. The Dice coefficient text similarity matching produces false matches.

**Drift Accumulates:**
After a table, subsequent content is matched to wrong Y positions because:
1. Table cell Y positions don't map cleanly to source lines
2. The interpolation for unmapped lines uses incorrect anchor points
3. Each subsequent match is influenced by prior incorrect anchors

---

## Proposed Solution: Direct Source Mapping in Typesetter

### Design Principle

**Track source line positions during layout, not after.**

The typesetter already knows which source positions correspond to which DrawOps. Instead of emitting only `sourceSpan` per op (char offsets), emit a complete `sourceMapping` array per page that maps source line numbers directly to Y ranges.

### New Architecture

```
Markdown → Typesetter.typeset() → TypesetResult
                                    ├── pages: PageLayout[]
                                    ├── diagnostics
                                    └── sourceMapping: SourceMappingEntry[] ← NEW: Direct from layout
                                                   ↓
                           pages.ts: Build sourceLineBoxes directly (simple, ~100 lines)
                                                   ↓
                           Reliable bidirectional sync
```

### Implementation Strategy

1. **Enhance layout/engine.ts** to track source line Y ranges during layout
   - Maintain a `Map<number, { pageIndex: number, yStartPt: number, yEndPt: number }>`
   - Update on each block/paragraph/cell that gets positioned
   - Emit as `sourceMapping` in `TypesetResult`

2. **Simplify source-mapping/resolver.ts** to:
   - Normalize the typesetter-provided mapping (validation only)
   - No text matching, no role detection, no interpolation
   - Keep as thin adapter (~100-150 lines)

3. **Simplify pages.ts** sourceLineBoxes logic:
   - Direct consumption of typesetter sourceMapping
   - Remove complex candidate selection
   - Remove multi-strategy fallbacks

---

## Detailed Technical Analysis

### Current resolver.ts Breakdown (1,294 lines)

| Section | Lines | Purpose | Recommendation |
|---------|-------|---------|----------------|
| Type definitions | ~60 | Define mapping types | Keep (move to types/) |
| `normalizeSourceMapping()` | ~50 | Validate incoming mapping | Keep |
| `resolveBestSourceMapping()` | ~40 | Choose between strategies | **Remove** |
| `deriveSourceMappingFromSourceSpans()` | ~80 | Extract from op sourceSpan | **Simplify** |
| `deriveSourceMappingFromRenderedLines()` | ~100 | Full text matching approach | **Remove** |
| `enrichSourceMappingCoverage()` | ~80 | Merge strategies | **Remove** |
| `matchSourceLinesToRenderedLines()` | ~100 | Text similarity matching | **Remove** |
| `buildSourceMappingFromMatches()` | ~80 | Convert matches to entries | **Remove** |
| `describeSourceLines()` | ~120 | Parse source for role detection | **Remove** |
| Text similarity functions | ~80 | Dice coefficient, bigrams | **Remove** |
| Coordinate utilities | ~100 | Y position math | Keep (move to utils) |
| Type guards and helpers | ~100 | Role normalization, etc. | Simplify |
| **Total** | ~1,294 |  | **Target: ~200** |

### pages.ts Complexity (790 lines)

The `rebuildSourceLineBoxes()` method is ~200 lines because it must compensate for unreliable input:
- `collectSourceLineCandidates()` handles multiple overlapping entries
- `selectBestCandidate()` chooses between conflicting data
- Interpolation logic fills gaps from bad data

With reliable input, this reduces to ~30 lines.

---

## Implementation Plan

### Phase 1: Typesetter Source Mapping (Core Fix)

**File: `src/canvadoc-typesetter/layout/engine.ts`**

Add source line tracking to `LayoutState`:
```typescript
type LayoutState = {
  // ... existing fields
  sourceLineRanges: Map<number, { pageIndex: number, yStartPt: number, yEndPt: number }>;
};
```

Update `layoutDocument()` to:
1. Initialize `sourceLineRanges` map
2. Call `trackSourceLines(block.sourceSpan, pageIndex, yStart, yEnd)` after positioning each block
3. Return `sourceMapping` array built from the map

Update block layout functions (`layoutParagraph`, `layoutTable`, `layoutCodeBlock`, etc.) to track Y ranges.

**File: `src/canvadoc-typesetter/types.ts`**

Add `sourceMapping` to `TypesetResult`:
```typescript
interface TypesetResult {
  pages: PageLayout[];
  diagnostics: TypesetDiagnostics;
  sourceMapping?: SourceMappingEntry[];  // Add this
}
```

### Phase 2: Simplify Resolver

**File: `src/source-mapping/resolver.ts`**

Reduce to:
```typescript
export function normalizeSourceMapping(candidate: unknown): SourceMappingEntry[] | null;
export function mergeSourceMappingPages(mapping: SourceMappingEntry[], pageOffsets: number[]): SourceMappingEntry[];
```

Remove:
- `deriveSourceMappingFromRenderedLines()`
- `matchSourceLinesToRenderedLines()`
- `describeSourceLines()`
- Text similarity functions
- Role detection logic

### Phase 3: Simplify pages.ts

Rewrite `rebuildSourceLineBoxes()` to directly consume the clean mapping without multi-candidate logic.

### Phase 4: Rename canvadoc-typesetter

1. Update import aliases in `tsconfig.json` and `vite.config.ts`
2. Change all imports from `'canvadoc-typesetter'` to relative paths or new alias
3. Remove the `canvadoc-typesetter` package name from references

---

## Tables: Special Handling Required

For tables, the source mapping must understand the table structure:

```markdown
| A | B |     ← Line 1 (header row)
|---|---|     ← Line 2 (separator, non-renderable)
| 1 | 2 |     ← Line 3 (data row 1)
| 3 | 4 |     ← Line 4 (data row 2)
```

The layout engine should emit:
```typescript
[
  { sourceLineStart: 1, sourceLineEnd: 1, pageIndex: 0, yStartPt: 100, yEndPt: 120 },
  // Line 2 (separator) maps to same Y range as adjacent content
  { sourceLineStart: 2, sourceLineEnd: 2, pageIndex: 0, yStartPt: 118, yEndPt: 122 },
  { sourceLineStart: 3, sourceLineEnd: 3, pageIndex: 0, yStartPt: 122, yEndPt: 142 },
  { sourceLineStart: 4, sourceLineEnd: 4, pageIndex: 0, yStartPt: 142, yEndPt: 162 },
]
```

The key insight is: **each table row's Y range should map to its source line**, not individual cells.

---

## Validation Strategy

### Test Cases That Currently Fail

1. **Click in table cell → jumps to wrong source line**
2. **Click after table → off by several lines**
3. **Click in code block after table → cumulative drift**

### Expected Behavior After Fix

1. Click in any table cell → cursor goes to that row's source line
2. Click after table → cursor is within ±1 line of correct position
3. No cumulative drift - each block is independently mapped

### Test File Updates

Add to `tests/typesetter-source-mapping.test.ts`:
```typescript
it('maps table rows to correct source lines', async () => {
  const markdown = `| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |`;
  const result = await typesetMarkdown(markdown, config);
  
  // Each row should have its own mapping entry
  expect(result.sourceMapping).toContainEqual(
    expect.objectContaining({ sourceLineStart: 1, sourceLineEnd: 1 })
  );
  expect(result.sourceMapping).toContainEqual(
    expect.objectContaining({ sourceLineStart: 3, sourceLineEnd: 3 })
  );
});
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing sync behavior | Medium | High | Comprehensive test suite; A/B validation |
| Performance regression | Low | Medium | Track layout timing; should be faster |
| Edge cases (math, nested lists) | Medium | Medium | Systematic testing of sample.md |
| Typesetter API changes | Low | Low | Internal module, full control |

---

## Summary

### Root Cause
The source mapping system uses a post-hoc text matching approach that cannot reliably handle tables and complex content.

### Solution
Generate source mapping directly during the layout phase when Y positions are being calculated, eliminating the need for heuristic reconstruction.

### Expected Outcome
- **~1,100 lines removed** from resolver.ts
- **~150 lines simplified** in pages.ts
- **Reliable bidirectional sync** for all content types
- **Cleaner architecture** with single source of truth

### Files to Modify
1. `src/canvadoc-typesetter/layout/engine.ts` - Add source line tracking
2. `src/canvadoc-typesetter/types.ts` - Add sourceMapping to TypesetResult
3. `src/source-mapping/resolver.ts` - Simplify to validation only
4. `src/pages.ts` - Simplify sourceLineBoxes building
5. `src/typesetter.ts` - Update to use direct mapping
6. Various import paths for canvadoc-typesetter rename

---

## Appendix: canvadoc-typesetter Renaming

The internal typesetter module should be renamed for clarity:

**Current state:**
- Directory: `src/canvadoc-typesetter/`
- Imports: `import { ... } from 'canvadoc-typesetter'`
- Aliased in tsconfig.json

**Proposed state (option A - keep alias, update name):**
- Directory: `src/typesetter-engine/` (or keep `src/canvadoc-typesetter/`)
- Import alias: Update to simpler name in tsconfig paths
- References in code: Use consistent import path

**Proposed state (option B - direct imports):**
- Keep directory: `src/canvadoc-typesetter/`
- Remove alias from tsconfig.json
- All imports use: `import { ... } from './canvadoc-typesetter/index.js'`

Option B is cleaner and avoids confusion between internal modules and npm packages.


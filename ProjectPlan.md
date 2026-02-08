# ProjectPlan.md - Markdown to Paginated A4 Preview and PDF Export

## 1. Product Purpose

Build a web app that:

- loads or pastes a Markdown document
- allows editing in a left pane
- renders a live paginated A4 preview in a right pane
- renders math with KaTeX
- preserves clean page flow across pages
- allows upload and save of Markdown files
- exports the rendered result to accurate, searchable PDF (Phase 2)

## 2. Phase 1 Status (Implemented)

Phase 1 is now considered implemented for the preview workflow.

### 2.1 Implemented capabilities

- split-pane editor and preview layout
- draggable pane divider (20% to 80%)
- markdown live rendering
- A4 page containers with configurable margins and font size
- KaTeX math rendering with HTML/SVG preview toggle
- improved block-aware pagination with better flow and keep-together rules
- matrix row-break handling for display math
- upload and save Markdown
- preview zoom controls: fit width, fit page, zoom in, zoom out
- dark/light app theme toggle (default dark)

### 2.2 Phase 1 constraints kept

- no PDF export implemented yet
- no server-side rendering required for preview
- preview pages remain white regardless of app theme

## 3. Current Architecture (Phase 1)

Single frontend app:

```
/src
  editor.ts
  markdown.ts
  katex.ts
  paginator.ts
  pages.ts
  ui.ts
index.html
style.css
```

Pipeline:

1. markdown input
2. markdown parse to DOM
3. math placeholders preserved from markdown stage
4. KaTeX render
5. pagination into A4 pages
6. preview display with viewport controls

## 4. Phase 2 Goal

Add high-fidelity PDF export from the rendered A4 pages with the following hard requirements:

- no rasterization of pages
- no screenshot-style PDF generation
- preserve text as searchable/selectable where possible
- preserve equation readability and quality
- keep file sizes practical
- keep output aligned with what the user sees in A4 preview

## 5. Phase 2 Non-Negotiables

- SVG math output is not acceptable for PDF export path
- export must use KaTeX HTML mode for equations
- output must be page-accurate A4
- export pipeline must be deterministic and testable

## 6. Phase 2 PDF Strategy Options

### Option A: Browser print pipeline (recommended)

Approach:

- build a dedicated print/export DOM from the same paginated page model
- force math mode to KaTeX HTML for export
- apply print CSS with strict A4 `@page` sizing and no scaling
- export via Chromium print-to-PDF (Playwright or equivalent)

Pros:

- best fidelity to existing rendered preview
- vector/text-oriented PDF, not raster
- equations stay crisp without SVG path rasterization
- implementation complexity is moderate and incremental

Cons:

- browser print engine differences must be controlled (lock to Chromium)
- embedded font behavior needs careful tuning for file size

### Option B: Custom PDF composition from document AST

Approach:

- parse markdown and layout content directly into PDF drawing commands
- reimplement pagination and math layout for PDF writer

Pros:

- maximal control over output internals

Cons:

- highest complexity and risk
- duplicates layout engine effort already done in browser
- long timeline before parity with preview

### Option C: Alternative server-side HTML-to-PDF engines

Approach:

- render HTML then convert with external engines (e.g., wkhtmltopdf/WeasyPrint)

Pros:

- can be automated in CI/server workflows

Cons:

- variable CSS/KaTeX compatibility
- higher drift risk versus browser preview output
- may require additional infrastructure

## 7. Chosen Path for Phase 2

Choose **Option A (Chromium print pipeline with KaTeX HTML mode)**.

Reasoning:

- highest practical fidelity to current A4 preview architecture
- satisfies "no raster screenshot PDF" constraint
- strongest chance of searchable text while keeping file size reasonable
- smallest architectural disruption versus current codebase

## 8. Phase 2 Requirements

### 8.1 Export UX

- add explicit `Export PDF` action
- keep preview toggle for HTML/SVG in UI, but export must always use HTML math mode
- show export progress and clear failure messages

### 8.2 Export renderer contract

- source pages must come from the same paginated model as preview
- export document must enforce A4 page size and zero browser auto-scaling
- each preview page maps to exactly one PDF page

### 8.3 Searchability and quality

- keep text content as text nodes in output DOM
- avoid canvas snapshots and image flattening
- validate equation text/search behavior on representative formulas and matrices

### 8.4 File size controls

- avoid unnecessary font duplication
- prefer stable font loading and subsetting behavior
- add size benchmarks to CI/manual checks

### 8.5 Determinism

- lock export runtime to known Chromium version
- lock CSS used in export mode
- add repeatable regression tests for page count and key layout anchors

## 9. Phase 2 Milestones

### M5 - Export Skeleton

- add export command path and print-only DOM
- implement A4 print CSS contract
- produce first non-raster PDF from sample documents

### M6 - Fidelity and Searchability

- force KaTeX HTML export mode
- verify equations/matrices are rendered correctly in PDF
- verify text and equations are searchable where supported

### M7 - Size and Stability

- optimize fonts and asset loading for smaller PDFs
- stabilize page-break parity with preview
- add regression tests and CI gate

### M8 - Release Readiness

- document export limitations and supported environments
- finalize troubleshooting and QA checklist

## 10. Testing Plan

### 10.1 Manual tests

- long multi-page markdown document
- dense matrix-heavy document
- mixed tables, code blocks, and display math
- verify preview-to-PDF page count parity

### 10.2 Automated checks

- unit tests for export prep logic
- integration test that exports PDF and validates page count and file signature
- golden checks for key layout markers on selected pages

## 11. Definition of Done

Phase 2 is complete when:

- Export PDF produces non-raster A4 pages from rendered content
- No screenshot/canvas flattening is used
- Output is visually aligned with preview pages
- Text remains selectable/searchable to the extent supported by KaTeX HTML + Chromium PDF output
- File sizes are acceptable on sample documents
- Tests and manual QA checklist pass
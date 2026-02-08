# ProjectPlan.md --- Markdown → Paginated A4 Web Preview with KaTeX

## 1. Purpose

Build a small web app that:

-   Loads or pastes a Markdown file.
-   Lets the user **edit** it in a left-hand pane.
-   Renders it live on the right as:
    -   Paginated **A4-style pages**
    -   With margins like a Word / LaTeX document
    -   Using KaTeX for math.
-   Ensures:
    -   Content flows cleanly between pages
    -   No awkward mid-equation or mid-table splits.
-   Allows:
    -   Saving the Markdown back to disk.

**PDF export is explicitly deferred** to a future file:
`ProjectPlanPhase2.md`.

------------------------------------------------------------------------

## 2. Non-Goals for Phase 1

Out of scope:

-   PDF generation
-   Font embedding
-   Print dialogs
-   Server-side rendering
-   Advanced typography engines
-   Citation managers
-   Float placement algorithms
-   Multi-column layouts

This is a **previewer**, not a publishing system yet.

------------------------------------------------------------------------

## 3. Target User Experience

Single-page web app:

    +----------------------+--------------------------+
    |                      |                          |
    |  Markdown Editor     |   Rendered Pages        |
    |                      |   (A4 stacked)          |
    |                      |                          |
    |                      |  ┌─────────────┐        |
    |                      |  │  Page 1     │        |
    |                      |  └─────────────┘        |
    |                      |  ┌─────────────┐        |
    |                      |  │  Page 2     │        |
    |                      |  └─────────────┘        |
    +----------------------+--------------------------+

Controls:

-   Upload `.md`
-   Save `.md`
-   Toggle math output:
    -   KaTeX HTML
    -   KaTeX SVG

------------------------------------------------------------------------

## 4. Core Requirements

### 4.1 Markdown Handling

Supported:

-   Headings
-   Paragraphs
-   Lists
-   Code blocks
-   Tables
-   Images
-   Horizontal rules
-   Inline math `$...$`
-   Display math `$$...$$`

Markdown parser can be off-the-shelf.

------------------------------------------------------------------------

### 4.2 Rendering

-   Markdown → HTML
-   KaTeX renders math inside it.
-   Output lives inside **page containers** sized like A4.

Each page:

-   Fixed width/height in CSS
-   Margins
-   White background
-   Drop shadow
-   Stacked vertically.

------------------------------------------------------------------------

### 4.3 Pagination Strategy (Phase 1: Pragmatic)

Instead of a full layout engine:

-   Render the document into a hidden container.
-   Measure block heights.
-   Flow blocks into page-sized divs.
-   Start a new page when height exceeds limit.

Rules:

-   Headings try to stay with following paragraph.
-   Tables and display-math must:
    -   Stay intact on one page **if possible**
    -   Move fully to next page otherwise.
-   Only split tables or matrices if taller than a page.

------------------------------------------------------------------------

### 4.4 KaTeX Modes

KaTeX must be configured so:

-   One toggle renders:
    -   HTML output (font-based)
    -   SVG output.
-   Both tested visually.
-   Architecture keeps this switch isolated.

This prepares for PDF later.

------------------------------------------------------------------------

### 4.5 Saving & Loading

-   Upload `.md` file.
-   Load into editor.
-   Download current editor content as `.md`.

Client-side only.

------------------------------------------------------------------------

## 5. Architecture (Simple)

No monorepo.

Single frontend app:

    /src
      editor.ts
      markdown.ts
      katex.ts
      paginator.ts
      pages.ts
      ui.ts
    index.html
    style.css

Pipeline:

    Markdown text
       ↓
    Markdown → HTML
       ↓
    KaTeX render
       ↓
    DOM blocks measured
       ↓
    Pagination into A4 divs
       ↓
    Display

------------------------------------------------------------------------

## 6. Pagination Rules

Page:

-   A4 portrait
-   CSS mm-based sizing
-   Fixed content height.

Block types:

  Block          Behaviour
  -------------- ------------------------
  Paragraph      Splittable
  Heading        Keep with next
  Display math   Atomic
  Table          Atomic unless too tall
  Code block     Atomic if possible
  Image          Atomic

------------------------------------------------------------------------

## 7. Styling

Simple theme for now:

-   Serif body font
-   Monospace for code
-   Comfortable margins
-   Page numbers optional.

No arbitrary CSS editor.

------------------------------------------------------------------------

## 8. Public API (internal modules)

``` ts
renderMarkdown(markdown: string): HTMLElement

renderMath(root: HTMLElement, mode: "html" | "svg"): void

paginate(
  content: HTMLElement,
  pageHeightPx: number
): HTMLElement[]
```

------------------------------------------------------------------------

## 9. Phase-1 Milestones

### M1 --- Editor + Live Preview

-   Split pane UI
-   Markdown typing → preview
-   KaTeX rendering
-   Scrollable pages.

------------------------------------------------------------------------

### M2 --- Pagination

-   A4 sizing
-   Flow blocks into pages
-   Prevent math/table splits.

------------------------------------------------------------------------

### M3 --- File Handling

-   Upload
-   Save
-   Reset.

------------------------------------------------------------------------

### M4 --- SVG / HTML Toggle

-   KaTeX output switch
-   Both modes tested.

------------------------------------------------------------------------

## 10. Testing

Manual is fine for Phase 1:

-   Multi-page maths document
-   Huge matrices
-   Long tables
-   Many paragraphs.

------------------------------------------------------------------------

## 11. Phase 2 (Separate File Later)

Handled later in:

    ProjectPlanPhase2.md

Will include:

-   PDF generation
-   Font embedding
-   Vector math
-   Headless Chromium experiments
-   Deterministic layout.

------------------------------------------------------------------------

## 12. Definition of Done (Phase 1)

This phase is complete when:

-   Markdown edits live-update preview.
-   Pages look like A4 sheets.
-   Equations render correctly.
-   No accidental half-equation page breaks.
-   Tables move intact.
-   User can upload and save Markdown.
-   SVG/HTML KaTeX modes can be toggled.

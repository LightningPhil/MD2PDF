# New Feature Exploration for MD2PDF

Date: February 13, 2026

## Current Baseline (for realistic effort estimates)

The app is in a strong state for deterministic text/math/table pagination and PDF export, but there are important constraints:

- Upload currently accepts `.md/.markdown/.txt` and reads text only.
- Document state stores only `filename + markdown content` (no asset bundle model yet).
- The markdown block parser currently supports: heading, paragraph, list, blockquote, code, display math, table, horizontal rule.
- The inline parser currently supports: text styles, links, inline code, inline math.
- The render operation model is text/rule/link/decorations; there is no native image draw operation.
- Layout is single-column with one content region per page.

Because of this, your requested features are mostly "typesetter architecture features", not just UI tweaks.

## Feature 1: ZIP Upload + Image Handling

### Goal

Upload one `.zip` that contains a markdown file plus image files, and reference images in markdown.

### Suggested syntax

- Prefer standard markdown image syntax: `![caption or alt](images/plot1.png)`
- Optionally support a stricter alias form for safety: `![alt](asset:plot1.png)`

### What needs to be added

- ZIP import path in upload flow (can reuse existing `jszip` dependency).
- Asset registry in document model (map logical path -> binary/image metadata).
- Markdown parser extension for image nodes (block and/or inline).
- New image draw operation in typesetter output.
- Canvas renderer support for image ops.
- PDF renderer support for image ops (PNG/JPEG embedding; SVG optional later).
- Size policy (max width default, optional width hints, keep aspect ratio).

### Difficulty

- Overall: **High (7/10)**
- MVP effort: **2-3 weeks**
- Production-ready effort (robust formats, scaling, errors, tests): **3-5 weeks**

### Main risks

- Memory usage for large image bundles.
- Consistent image rendering between canvas and PDF.
- Path normalization and security checks in ZIP contents.

## Feature 2: ZIP Upload + CSV Plot Rendering

### Goal

Upload markdown + CSV files in a ZIP, and insert nicely rendered plots (single full-width and subplot grids up to 3x3).

### Suggested syntax

Use an explicit fenced directive (clear and extensible), for example:

````text
```plot
source: data/experiment_a.csv
type: line
x: time_s
y: voltage_v
layout: full
style: ieee
caption: Step response
label: fig:step-response
```
````

### What needs to be added

- CSV asset loading and schema validation.
- Plot spec parser and validation.
- Plot layout engine:
  - Axes, ticks, labels, legend, grids, line/bar/scatter.
  - Subplot layout up to 3x3.
- Rendering strategy:
  - MVP: rasterize plot to offscreen canvas, embed as image op.
  - Later: native vector draw ops for sharper/smaller PDFs.

### Difficulty

- Overall: **Very High (8.5/10)**
- MVP effort (line/bar/scatter, limited styles, full-width only): **3-4 weeks**
- Full target effort (subplots, polished style controls, robust legends/axes): **5-8 weeks**

### Main risks

- Plot aesthetics and label collision handling are deceptively hard.
- Subplot spacing and readability on A4/Letter pages.
- Matching matplotlib-like expectations while keeping deterministic layout.

## Feature 3: Figure and Table Captions

### Goal

Support publication-style captions and numbering.

### Suggested behavior

- Auto numbering:
  - `Figure 1`, `Figure 2`, ...
  - `Table 1`, `Table 2`, ...
- Optional labels for cross references (`fig:...`, `tbl:...`).
- Caption placement defaults:
  - Figures: below
  - Tables: above (configurable)

### What needs to be added

- New caption node(s) in parser/AST.
- Numbering pass over document structure.
- Optional label/reference resolution pass.
- Styling controls (font size, spacing, prefix format).

### Difficulty

- Captions only: **Medium (5/10)**, **1-2 weeks**
- Captions + labels + cross-refs: **High (7/10)**, **2-3 weeks**

### Main risks

- Cross-reference resolution order and edge cases on missing labels.
- Keeping numbering stable under live edits.

## Feature 4: IEEE-style References

### Goal

Citation and bibliography support similar to scientific writing workflows, starting with IEEE numeric style.

### Suggested input model

- Citation syntax in text: `[@smith2023]` or `\cite{smith2023}`
- Bibliography source in ZIP:
  - Preferred: `references.bib`
  - Optional: JSON/YAML in later phases

### What needs to be added

- Citation parser and key collector.
- Bibliography parser (BibTeX subset is enough to start).
- Reference resolver:
  - Number by first appearance for IEEE style.
  - Generate bibliography section in numbered order.
- IEEE formatter for common entry types (article, conference, book, thesis).

### Difficulty

- Overall: **High (8/10)**
- MVP effort (common BibTeX fields and entry types): **3-5 weeks**
- Broader BibTeX compatibility and polish: **5-8 weeks**

### Main risks

- BibTeX edge cases and inconsistent real-world data.
- Name formatting rules and punctuation details for IEEE compliance.

## Markdown Extensions vs LaTeX Subset

### Practical recommendation

Use a **two-track strategy**:

1. Keep current markdown path as the stable baseline.
2. Add a **LaTeX subset parser** that compiles into the same internal document model.

This avoids rewriting rendering twice and lets both syntaxes coexist.

### Why this is sensible

- The hard part (deterministic canvas/PDF rendering and pagination) is already strong.
- The parser/AST layer can be expanded without throwing away the current architecture.
- You can ship value incrementally (images/captions/references in markdown-first form) while growing LaTeX compatibility.

## Proposed LaTeX Subset Scope

### Phase L1: Single-column scientific draft mode

Support a constrained subset:

- Sections: `\section`, `\subsection`, `\subsubsection`
- Lists: `itemize`, `enumerate`
- Math: existing inline/display math path
- Figures/tables:
  - `\begin{figure} ... \includegraphics ... \caption ... \label ... \end{figure}`
  - `\begin{table} ... \caption ... \label ... \end{table}`
- Citations/references:
  - `\cite{key}`, `\ref{label}`, bibliography block

Important simplification: treat figure/table placement as in-flow blocks first (not full float behavior).

Difficulty: **High (7.5/10)**, **4-7 weeks**

### Phase L2: Two-column paper layout

Target style:

- First page with full-width title/authors/abstract header.
- Main body in two columns.
- Optional full-width elements (`figure*`, `table*` style equivalents).

Core engine work required:

- Multi-region page model (single column on top area, dual columns in body).
- Column-aware flow and pagination.
- Cross-column balancing (especially final page).

Difficulty: **Very High (9/10)**, **6-10 weeks**

## Recommended Delivery Order

1. ZIP ingest + asset registry foundation.
2. Image nodes + image rendering ops.
3. Captions and numbering.
4. Citation/references (IEEE MVP).
5. CSV plot MVP (full-width first, limited plot types).
6. LaTeX subset parser (single-column).
7. Two-column scientific layout mode.

## Overall Feasibility

This is a realistic direction. The renderer foundation is already good enough to justify building a scientific-authoring layer. The major architectural call is to keep one core layout/render engine and add syntax/front-end parsing layers (Markdown+extensions and LaTeX-subset) that feed into a shared internal model.

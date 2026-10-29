# MD2PDF - Markdown to Paginated Preview

A web app that loads/edits Markdown and renders it live as paginated paper-style pages with KaTeX math support.

## Features

- Collapsible left file panel with open markdown files and per-file page counts
- Split-pane interface: editor on the left, paginated preview on the right
- Live preview while typing
- Formatting toolbar for headings, bold, italic, strikethrough, lists, quotes, links, tables, code, and horizontal rules
- Function and equation editor with live validation, templates, math symbols, and inline/display placement
- Visual equation entry with fraction, root, exponent and matrix boxes; Tab moves between fields
- Autosave and recovery of open documents, per-document styles, selection and workspace layout
- Document presets and personal presets, title pages, linked contents, headers/footers and numbering
- Heading outline, synchronized scrolling, preview-to-source navigation, find/replace and focus mode
- Visual table grid and image tools with captions, alternative text, sizing and paste/drop support
- Numbered equations, figures and tables with automatic cross-references
- Portable ZIP packages containing Markdown, document settings and embedded image files
- Output checks for invalid equations, broken images/references, duplicate labels and clipped content
- Local KaTeX renderer and fonts; math preview does not require a CDN
- KaTeX math rendering with HTML/SVG toggle
- Smart pagination to avoid splitting tables and display equations
- Page sizes: A4, Letter, Legal, Tabloid, A3
- Preview controls: fit width, fit page, zoom in/out, zoom percentage
- Theme toggle for app chrome (rendered page stays white)
- Multi-file upload/save and drag-and-drop for `.md`
- PDF export:
  - In-app `Export PDF` button (headless API export, no print dialog)
  - All-files scope in the export dialog (headless API export to ZIP, no print dialog)
  - Linked PDF bookmarks and accessibility tags
  - Headless CLI export via Playwright/Chromium (no dialog)
  - Batch headless export with optional ZIP packaging

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run Dev Server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Build

```bash
npm run build
```

## Commands

- `npm run typecheck` - TypeScript checks
- `npm test` - Run unit tests
- `npm run test:e2e` - Build and test complete browser workflows, including real PDF and batch export (requires Playwright Chromium)
- `npm run preview` - Preview production build

PDF export (CLI):

- Flag style:
  - `npm run export:pdf -- --input samples/sample.md --output dist/exports/sample.pdf --page-size a4`
- Positional style:
  - `npm run export:pdf -- samples/sample.md dist/exports/sample.pdf a4`
- Batch + ZIP:
  - `npm run export:pdf:batch -- --input-dir samples --recursive --out-dir dist/exports/run1 --zip dist/exports/run1.zip --page-size a4`

## Usage

1. Edit Markdown in the left pane.
2. Use math syntax:
   - Inline: `$...$`
   - Display: `$$...$$`
3. Use `Upload` to load one or many `.md` files.
4. Select files from the collapsible left panel.
5. Use `Save` to download the currently selected Markdown file.
6. Use `Export PDF` to download the currently selected file as PDF.
7. Choose **All open files** in the export dialog to download one ZIP of PDFs. Each file retains its own style and paper size.
8. Use `Math` toggle to switch HTML/SVG render mode.

### Writing and editing equations

Select text and use the formatting toolbar to format it. With no selection, emphasis tools insert a selected placeholder ready to replace. List and heading tools operate on whole lines. Use Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic, and Ctrl/Cmd+K for links. Ctrl/Cmd+Z undoes typing and toolbar edits; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes them.

Click **ƒx Equation** or press **Ctrl/Cmd+Shift+E** to open the function and equation editor. Choose a starting template (functions, fractions, roots, sums, integrals, limits, derivatives, matrices, cases, or aligned equations), then edit its values while watching the preview. Structure buttons insert at the cursor or wrap selected text; symbols insert where you are typing. Choose inline or display placement and insert the equation. Invalid expressions show an explanation before insertion.

To revise an equation, place the Markdown cursor inside its `$...$` or `$$...$$` delimiters and reopen the equation editor. **Update equation** replaces the original expression. Cancel or Escape leaves your Markdown unchanged.

The visual editor supports ordinary typing and a math keyboard. Select an expression and use **Fraction boxes**, **Root box**, **Exponent box**, **Subscript box**, or the matrix control; use Tab to move between empty boxes. **Edit LaTeX source** remains available for direct entry. Click an equation in the page preview to edit it.

### Document layout and styles

Open **Style & layout** to select Simple document, Technical report, Academic, or Study notes. Adjust fonts, size, line/paragraph spacing, paper, margin and accent colour. Save named personal presets for reuse. Changes apply to the current document, so open files can use different styles.

The same dialog enables a separate title page, linked contents with page numbers, automatic equation numbering, running headers/footers, and page-number formats. Running text supports `{page}` and `{pages}`. **Page break** inserts `<!-- pagebreak -->` at the writing cursor. Contents links and heading bookmarks are included in PDFs. PDF exports include structural tags; this does not certify full PDF accessibility compliance.

### Tables, images and references

**Table** opens a grid with column alignment and row/column controls. Place the cursor inside an existing table to edit it, or double-click its preview. Images can be uploaded, pasted or dropped into the editor. **Image** sets width, caption and alternative text; click a preview image to reopen its settings. PNG, JPEG, WebP and GIF files up to 20 MB are supported.

Add optional labels such as `eq:energy`, `fig:diagram` and `tab:results` in their respective editors. **Reference** inserts a linked reference that updates as numbered items move. The source syntax is `[@eq:energy]`, `[@fig:diagram]` or `[@tab:results]`. Display equation labels follow the closing delimiter: `$$ {#eq:energy}`. Captioned table labels use a separate line after the table: `: Results {#tab:results}`. These extensions are interpreted by MD2PDF.

### Recovery and portable documents

Documents and embedded images autosave to IndexedDB in this browser. The status beside the editor title reports saving, recovery or storage failures. Open files, their individual styles, cursor/scroll positions, pane split, sidebar state and scroll-sync preference recover on reload. Clearing browser site data removes this local workspace. Downloads remain the portable backup.

**Save** downloads Markdown with a hidden settings comment, which MD2PDF reads when reopening it. **Save package** downloads a ZIP with Markdown, settings and extracted embedded images in an `assets/` folder. **Open package** restores the document and embeds its images again. Remote image URLs remain remote; attach the image file to include it in a package.

### Navigation and output checks

Use the heading outline to move through a document. Clicking preview text moves to its Markdown block; the current block is highlighted. **Scroll sync** works in both directions and can be switched off. Split paragraphs use approximate source positions. **Find / replace** supports case matching, previous/next, single replacement and one-step undoable replacement of all matches. Ctrl/Cmd+F or Ctrl/Cmd+H opens it. **Focus** expands the writing pane; Escape exits focus mode.

**Check output** reports invalid equations, missing images, missing or duplicate references, oversized blocks, clipped running text and stranded headings. Checks also run when opening the PDF export dialog and changing export scope. Select an issue to move to the relevant document and source location. Export remains available when there are issues, so reviewed warnings do not block a download.

## Supported Markdown

- Headings (H1-H6)
- Paragraphs, bold, italic
- Ordered and unordered lists
- Inline code and fenced code blocks
- Tables
- Images
- Horizontal rules
- Inline and display math

## Project Structure

- `src/main.ts` - App entry and orchestration
- `src/editor.ts` - Editor behavior
- `src/markdown.ts` - Markdown parsing and math placeholders
- `src/katex.ts` - Math rendering
- `src/paginator.ts` - Pagination engine
- `src/pages.ts` - Page creation/management
- `src/ui.ts` - UI controls and interactions
- `tests/` - Vitest test suite
- `index.html` - HTML shell
- `style.css` - Styling

## Scope Notes

Current implementation is still progressing through Phase 2. The headless PDF path now exists in-app and via CLI, while advanced packaging details like embedded font workflows are still future work.

## Author

Philip Leichauer


## Native LaTeX mode

Choose **New LaTeX document**, upload a `.tex` file, or change **Source format**.
Changing the format preserves the source verbatim; it does not convert Markdown into LaTeX.
The filename extension records the mode and survives workspace restoration.
Use **Compile LaTeX** or **Ctrl+Enter** to refresh the PDF. Editing invalidates the previous preview.
The command toolbar inserts sections, lists, equations, tables, citations, references and footnotes.
**Visual equation** also inserts native equation environments and edits existing equations.
Compiler diagnostics jump to source lines, and the full compiler log is available below the status.
Save downloads plain `.tex`; Export PDF compiles the current source, and batch export supports mixed Markdown/LaTeX workspaces.

This mode requires MiKTeX `pdflatex` on the server's PATH and runs through `npm run dev` or `npm run preview` (not a static file host).
It compiles the selected main file, runs bibliography and index processors as needed, then recompiles references and contents. Shell escape and automatic package installation are disabled during builds.
Missing packages are reported in the compiler log; install needed packages through MiKTeX Console.
PDF previews use bundled PDF.js and do not depend on a browser PDF plug-in.
LaTeX controls page layout through its preamble, so Markdown page/style controls are hidden in that mode.

Compared with Markdown, native LaTeX supplies document classes, macros, theorem environments, AMS mathematics,
float placement and TeX typography through installed packages. The command-line Markdown exporters remain Markdown-only.

### Projects, assets and build tools

Open **Project files & build** in LaTeX mode to:

- Create and edit supporting `.tex`, `.bib`, `.sty`, `.cls` and other text files with relative paths.
- Upload images, PDFs, font files and other supported assets; import an entire folder or project ZIP.
- Choose the main `.tex` file and pdfLaTeX, XeLaTeX or LuaLaTeX. The primary source stays in the main editor; included files use the project editor.
- Choose automatic bibliography detection, explicit BibTeX/Biber, or disable bibliography processing.
- Enable or disable MakeIndex. Use `\makeindex`, `\index{...}` and `\printindex` in your document.
- Save a project ZIP containing all source files, assets and build settings. Normal Save still downloads only the primary `.tex` source.

Use `\input{chapters/intro}`, `\includegraphics{images/chart.png}`, and bibliography paths relative to the project root.
PNG/JPEG/PDF figures work without shell escape. EPS conversion and tools requiring shell escape are not enabled.
Automatic bibliography detection uses generated `.bcf` (Biber) or `\bibdata` in the main `.aux` (BibTeX).
The standard main index is processed with MakeIndex; custom multi-index/glossary pipelines are not currently orchestrated.
Project files, assets and build settings are included in autosave and current/batch PDF exports.
Limits: 200 files, 50 MB total project data, 20 MB per uploaded asset, and 2 MB primary source.
The compiler is a local desktop service for trusted projects, not a sandbox for untrusted LaTeX/Lua programs.
LuaLaTeX permits the absolute font/Unicode-data reads required by its font loader.

### SyncTeX navigation

After compilation, **Show cursor in PDF** jumps from either source editor to the matching PDF location and highlights it.
Double-click a PDF page to return to its source line, opening the included-file editor when necessary.
Editing source, project files or build settings invalidates the mapping; compile again before navigating.
Cached SyncTeX builds expire after 20 minutes or cache eviction; the UI asks you to compile again if needed.

Required local tools are `pdflatex`, `xelatex`, `lualatex`, `bibtex`, `biber`, `makeindex`, and `synctex` on PATH.
Missing packages or engine formats appear in the compiler log. MiKTeX Console manages these dependencies.
This machine was additionally prepared with `logreq`, `lua-uni-algos`, and initialized XeLaTeX/LuaLaTeX formats.

Run `npm run test:latex` for browser tests covering projects, assets, ZIP round-trips, navigation and PDF export.
Run `npm run test:latex:native` for all three engines, BibTeX/Biber, MakeIndex, Unicode fonts and SyncTeX.
These tests require MiKTeX; the browser tests also require Playwright Chromium.

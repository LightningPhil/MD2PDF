# MD2PDF - Markdown to Paginated Preview

A web app that loads/edits Markdown and renders it live as paginated paper-style pages with KaTeX math support.

## Features

- Collapsible left file panel with open markdown files and per-file page counts
- Split-pane interface: editor on the left, paginated preview on the right
- Live preview while typing
- KaTeX math rendering with HTML/SVG toggle
- Smart pagination to avoid splitting tables and display equations
- Bidirectional source sync between editor and rendered preview
- Page sizes: A4, Letter, Legal, Tabloid, A3
- Preview controls: fit width, fit page, zoom in/out, zoom percentage
- Theme toggle for app chrome (rendered page stays white)
- Multi-file upload/save and drag-and-drop for `.md`
- File list actions: select, rename (download name), and close
- PDF export:
  - In-app `Export PDF` button with modal scope selection (current file or all files)
  - Headless API export (no print dialog) with live progress, logs, timing, and cancel
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
6. Use `Export PDF`, choose `Current file` or `All open files`, then start export.
7. Click in markdown to focus preview, or click preview blocks to focus markdown lines.
8. Use `Math` toggle to switch HTML/SVG render mode.

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

Current planned scope is complete for the existing project plan, including headless single and batch PDF export.

## Author

Philip Leichauer

# MD2PDF - Markdown to Paginated Preview

A web app that loads/edits Markdown and renders it live as paginated paper-style pages with KaTeX math support.

## Features

- Split-pane interface: editor on the left, paginated preview on the right
- Live preview while typing
- KaTeX math rendering with HTML/SVG toggle
- Smart pagination to avoid splitting tables and display equations
- Page sizes: A4, Letter, Legal, Tabloid, A3
- Preview controls: fit width, fit page, zoom in/out, zoom percentage
- Theme toggle for app chrome (rendered page stays white)
- File upload/save and drag-and-drop for `.md`
- PDF export:
  - In-app `Export PDF` button (browser print to PDF)
  - CLI export via Playwright/Chromium

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

## Usage

1. Edit Markdown in the left pane.
2. Use math syntax:
   - Inline: `$...$`
   - Display: `$$...$$`
3. Use `Upload` to load `.md` files.
4. Use `Save` to download Markdown.
5. Use `Export PDF` to open print dialog and save as PDF.
6. Use `Math` toggle to switch HTML/SVG render mode.

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

Current implementation is still progressing through Phase 2. The PDF path now exists (in-app print and CLI), while advanced packaging details like embedded font workflows are still future work.

## Author

Philip Leichauer

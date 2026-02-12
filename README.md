# MD2PDF - Markdown to Paginated Preview

A web app that loads/edits Markdown and renders it live as paginated paper-style pages with full math support, powered by an integrated `canvadoc-typesetter` engine.

## Features

- Collapsible left file panel with open markdown files and per-file page counts
- Split-pane interface: editor on the left, canvas preview on the right
- Live preview while typing
- Full math rendering (inline and display equations)
- Smart pagination to avoid splitting tables and display equations
- Page sizes: A4, Letter, Legal, Tabloid, A3
- Preview controls: fit width, fit page, zoom in/out, zoom percentage
- Theme toggle for app chrome (rendered page stays white)
- Multi-file upload/save and drag-and-drop for `.md`
- File list actions: select, rename (download name), and close
- Client-side PDF export (no server required)

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

Open `http://localhost:5173`.

### Build

```bash
npm run build
```

Outputs to `dist/` directory.

## Commands

- `npm run typecheck` - TypeScript checks
- `npm test` - Run unit tests
- `npm run preview` - Preview production build

## Usage

1. Edit Markdown in the left pane.
2. Use math syntax:
   - Inline: `$...$`
   - Display: `$$...$$`
3. Use `Upload` to load one or many `.md` files.
4. Select files from the collapsible left panel.
5. Use `Save` to download the currently selected Markdown file.
6. Use `Export PDF` to generate a PDF of the current document.
7. Use `Math` toggle to switch between render modes.

## Supported Markdown

- Headings (H1-H6)
- Paragraphs, bold, italic
- Ordered and unordered lists
- Inline code and fenced code blocks
- Tables
- Images
- Horizontal rules
- Inline and display math

## Architecture

MD2PDF uses an integrated **canvadoc-typesetter** engine, a deterministic markdown typesetter that renders identically to both HTML canvas and PDF:

- `src/main.ts` - App entry and orchestration
- `src/editor.ts` - Editor behavior
- `src/typesetter.ts` - Bridge to canvadoc-typesetter
- `src/canvadoc-typesetter/` - Core markdown typesetting engine
- `src/pages.ts` - Canvas-based page rendering
- `src/ui.ts` - UI controls and interactions
- `tests/` - Vitest test suite
- `index.html` - HTML shell
- `style.css` - Styling

## Author

Philip Leichauer

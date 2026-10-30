# MD2PDF

[**Open MD2PDF in your browser**](https://lightningphil.github.io/MD2PDF/)

A free, MIT-licensed Markdown editor with visual equations, formatting tools, paginated previews and PDF output. Runs entirely in your browser: no account, installation, server, remote compiler or document uploads required.

## Write and export

1. Type or upload Markdown, or use the formatting and equation tools.
2. Choose paper size, document style, margins, headers and page numbering.
3. Click **Export PDF**, then **Start export**. In your browser's print dialog choose **Save as PDF**.
4. Turn off browser headers and footers and keep scaling at 100%. Enable background graphics if you want shaded tables/code blocks.

**All open files** prepares one combined PDF, preserving each document's paper size and styles. Text remains selectable and equations stay sharp; pages are not flattened into screenshots. Print-dialog capabilities vary by browser; current Chrome or Edge is recommended.

## Features

- Bold, italic, headings, lists, links, code blocks and tables
- Visual function/equation editor, templates, symbols, fraction/root/matrix boxes and LaTeX math syntax through KaTeX
- Table grid editor and image upload/paste/drop, captions and references
- Document presets, cover pages, contents, headers/footers and page numbers
- Automatic equation, figure and table numbering and cross-references
- Smart pagination and explicit page breaks
- Find/replace, undo/redo, outline navigation, source/preview scrolling and focus mode
- Local autosave of open documents, selection and layout
- Save/open portable Markdown ZIP packages containing images and document settings
- Checks for broken equations, images, references and layout overflow
- Light/dark interface and responsive layout

Full LaTeX document compilation, native TeX engines, BibTeX/Biber, MakeIndex, SyncTeX and server-side export jobs have been removed. The equation editor still supports LaTeX **math expressions** locally.

## Your documents and moving between PCs

Documents are saved in the current browser's local storage. They are not uploaded or synchronized between computers. Use **Save** for Markdown or **Save package** for a ZIP containing the document, images and settings; open that file on another PC. Clearing browser data removes local autosaves, so keep saved copies of important work.

## Contributing

Contributions, bug reports and improvements are welcome. Open an issue or pull request on [GitHub](https://github.com/LightningPhil/MD2PDF).

For local development, install Node.js 24 or newer:

```bash
npm ci
npm run dev
```

Checks and builds:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run test:pages
npm run build
npm run build:pages
```

Browser tests require Playwright Chromium (`npx playwright install chromium`). `build:pages` uses `/MD2PDF/` as its default base path; set `PAGES_BASE_PATH` for another repository or hosting location.

## GitHub Pages deployment

The Pages workflow tests and builds the app on every push to `main`, then publishes `dist/` through GitHub Actions. Set **Settings → Pages → Source** to **GitHub Actions**. The same build can also be served by any static web host.

## License

Copyright © 2026 Philip Leichauer. Released under the [MIT License](LICENSE). Bundled dependencies retain their own licenses; see the distributed third-party notices.

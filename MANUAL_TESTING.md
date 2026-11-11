# Live acceptance campaign for short documents

This is the repeatable campaign following the [code review and repairs](docs/CODE_REVIEW.md). The [6 November live review](docs/LIVE_REVIEW.md) records browser observations for all 39 stories, repairs and the remaining native-print/input/fault checks. The full [39 stories](docs/USE_CASES.md) contain the acceptance criteria; the [feature matrix](docs/FEATURE_COVERAGE.md) lists every option family. Historical Phase 1 results are not current passes.

## Setup and recording

Use a separate browser profile and test documents, with saved external copies. Record date, OS/browser/version, viewport, source/package, story IDs, expected/actual result, screenshot or PDF, and pass/fail. Use Node.js 24+, `npm ci`, and `npx playwright install chromium` for the automated browser suites.

In the normal release environment, run `npm run test:e2e` and `npm run test:pages`. These launch browsers and local servers; they were not run by the connected-browser campaign. For manual tests, use `npm run dev` and the URL printed by Vite. Do not assume an old hard-coded port. The browser suites simulate print requests and afterprint; native Save as PDF and cancel must still be checked manually.

## Campaign covering every story

| Campaign | Stories | Work and expected outcome |
| --- | --- | --- |
| Engineering brief | UC-01, UC-10, UC-11, UC-12, UC-18, UC-24 | Write a 2–4 page note with headings, emphasis, all list/quote/code tools, link, rule, table and equation. Exercise every equation template/symbol/source structure. Add/reorder object references. Breaks, literal text, numbering and reading order survive export. |
| Existing report | UC-02, UC-05, UC-06, UC-27, UC-37 | Upload/drop single and multiple Markdown/TXT files, including duplicate case-insensitive names, unsupported members and read failures. Switch, rename/cancel/blank rename, save, reopen, compare revisions. Search both directions, wrap after replacement, case mode, Unicode offsets and literal replacement text. No existing draft is overwritten. |
| Research update and handout | UC-03, UC-04, UC-13, UC-14, UC-36 | Prepare a supervisor update and a method handout. Try every visual box, template and symbol, matrix, source sync, keyboard, inline/display placement and preview edit. Cancel changes, reject invalid/incomplete math and labels. Quotes/reading links remain readable; references to literature are manual. |
| Tables, images and references | UC-15, UC-16, UC-17, UC-18 | Edit grid headers/cells, all alignments, escaped pipes, add/remove row/column and limits. Retain a caption without a label. Upload/paste/drop each supported image type; reject unsupported/oversized files. Edit the second of two identical inline images, change source rapidly, resize and add alt/caption/label. Test slow/broken/remote/embedded images. References update correctly. |
| Styles and page furniture | UC-19, UC-20, UC-21, UC-22, UC-23 | All four presets; save/reload/delete a custom preset; cancel unapplied settings; denied preset storage. Exercise font/spacing/margin bounds and five paper sizes. Cover-only and long cover; no headings and long contents; every page-number mode and running-text token. Contents destinations/page numbers and per-file settings are correct. |
| Navigation and workspace | UC-25, UC-26, UC-29, UC-30 | Fit width/page, zoom bounds, Ctrl+wheel, panning and resize; sidebar/outline, preview source jumps and two-way scroll with sync off/on. Pointer and keyboard divider including Home/End, persisted split, focus/Escape and themes. Check 1500, 1200, 650 and 375px widths. Every open file remains reachable. |
| Draft protection and recovery | UC-07, UC-08, UC-28 | Edit A and B, switch and undo/redo without cross-contamination. Close confirmation Cancel preserves the draft. Confirm active/inactive/last closure; last close clears source, outline and old running text. Reload restores open documents/settings/selection/layout; undo history does not persist. Deny/fill storage and interrupt saving: status must not claim success. |
| Portable handoff | UC-09, UC-35, UC-37 | Save a package with repeated embedded images, existing text mentioning asset paths, Unicode and custom settings. Reopen on another browser/PC and compare source/assets/settings. Test malformed ZIP/manifest, missing document, excessive entries and expansion limits. Remote URLs remain remote. No account or app backend is required. |
| Output diagnosis and export | UC-31, UC-32, UC-33, UC-34 | Check current/all files; select each issue and reach the correct source/file. Invalid equation, missing/duplicate label, broken image, long header/footer, tall/wide table/code/math/image must be diagnosed. Blocking errors prevent print; fix and retry. Export one document and a mixed-style/size pack. Exercise modal dismissal, busy state, native cancel/afterprint, repeated export and failure recovery. |
| Safe rendering and compatibility | UC-11, UC-35, UC-39 | Code/escaped text containing harmless HTML event-handler fixtures and dollar signs stays literal in preview and export; no handler executes. Use multiple backtick/tilde fence lengths and escaped currency. Restore a legacy .tex draft, save its raw source, reject current/all TeX PDF export, then export Markdown. No SVG/job-progress/CLI compiler control is advertised. |
| Release evidence | UC-38 | Run typecheck, unit coverage, both browser suites, both builds, npm audit and traceability validation. Inspect bundled fonts/notices/subpath assets, offline-after-load behaviour and first-use lazy failure. Record failures rather than reusing baseline evidence. No full accessibility/security/PDF-conformance certification is implied. |

## Native PDF checks

For an engineering note, imported report, research update and combined pack, choose Save as PDF, 100% scale, browser headers/footers off, and background graphics on when required. Inspect **every page** for clipping, missing content, font/math quality, table colours, cover/contents, whitespace and document transitions. Search/copy a distinctive phrase and code sample; check internal and external links. Compare paper dimensions with settings. Mixed documents must keep their own table colours and numbering.

Cancel the native dialog, return to editing, and export again. Verify temporary output is removed and the document title returns. The app cannot determine whether a PDF was actually saved; UI wording must not claim native-save completion.

## Keyboard and failure focus

Tab and Shift+Tab must exit the source editor. Ctrl/Cmd+] inserts two spaces. Traverse every control without a pointer; check visible focus, dialog focus containment/Escape/return, issue navigation from the export dialog, and native close confirmation. Inspect with a screen reader and touch input where available.

Cold offline launch and the first lazy visual-editor load are not guaranteed. Failed visual loading must explain the LaTeX fallback. Storage is local, not backup or collaboration. A confirmed close has no trash/recovery path; ensure the warning and Cancel-to-save workflow are clear. Indivisible oversized objects require manual adjustment; output checks are assistance, not a substitute for inspecting the final PDF.

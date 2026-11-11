# MD2PDF audit for short engineering and academic documents

> **Historical baseline audit.** The findings and browser/PDF results below describe the pre-repair commit. The subsequent [code review](CODE_REVIEW.md) and [live browser review](LIVE_REVIEW.md) record the repairs, story-by-story evidence and remaining checks. Do not treat baseline browser/PDF passes as verification of the current source.

MD2PDF has a useful foundation for polished short reports: editable Markdown, mathematical notation, visual tables and images, document styles, page previews, and browser PDF export. It is suitable in scope for engineering briefs, small technical reports, supervisor updates, and study notes. It should not yet be treated as a fully reliable document tool: this audit reproduced an imported-content execution defect, document-loss hazards, and several presentation and accessibility failures.

The recommended priority is to repair safe rendering and draft preservation, then correct navigation and output-fidelity defects. Expanding into full thesis production would distract from those priorities.

## Deliverables and scope

- [39 use cases with user stories](USE_CASES.md), including realistic document scenarios, main flows, exceptions, and acceptance criteria.
- [Feature coverage matrix](FEATURE_COVERAGE.md), mapping every inventoried capability and option family to at least one use case.
- [Function coverage appendix](FUNCTION_COVERAGE.md) and [machine-readable traceability](audit/coverage.json), covering application functions, methods, constructors, callbacks, and supporting tracked files.
- [Targeted browser probes](../scripts/audit-probes.mjs), [recorded observations](audit/probe-results.json), and [PDF inspection results](audit/pdf-results.json).
- [Coverage validator](../scripts/check-audit-coverage.mjs), which detects missing associations, missing stories, changed source snapshots, and newly untracked-by-the-audit repository files.

Review date: **6 November 2026**. Baseline: **`10aa70fdd2361587b32b33586a822d344a9700f2`**, package version **0.1.0**. The checkout was clean before this task. Application behaviour was not changed by the audit; added files document and reproduce observations.

This is a functional, implementation, and use-case coverage audit, with targeted safety, accessibility, persistence, and PDF checks. It does not claim exhaustive penetration testing, dependency-vulnerability assessment, WCAG certification, formal PDF conformance, or a tested maximum document size. “Covered” means associated with a concrete user story and acceptance outcome; it does not mean executed, passing, or 100% statement/branch coverage.

The baseline inventory contained **39 use cases, 130 capability groups, 520 application callables, 721 total first-party callables, and 78 repository files**, with **zero missing or invalid associations**. “Callable” includes anonymous callbacks as well as named functions, methods, and constructors; the total includes verification/build/audit tooling.

`ProjectPlan.md` remains the repository's recorded intent. Its older statements are compared with current behaviour rather than silently treated as current implementation. Current code, README, and the user's short-document requirement establish what the catalogue describes. Historical documents were retained, and their contradictions are recorded below.

## Fit for the requested work

| Need | Assessment | Material conditions |
| --- | --- | --- |
| Engineering note for colleagues | Good functional fit | Repair safe rendering and draft-loss problems; inspect equations and page flow |
| Existing Markdown/text report made attractive | Good functional fit | Word/PDF files need external conversion; repair missing images and captions |
| Test report with a few figures and result tables | Good functional fit | Tables remain atomic; large tables and images need manual adjustment |
| Research method note or supervisor update | Good functional fit | Equations and object references are supported; references to literature are manual |
| Study handout or short literature summary | Good functional fit | Code/currency rendering needs repair; no citation manager or footnote workflow |
| Combined meeting pack | Available with limitations | No reorder UI, master contents, or continuous numbering; preset-colour defect |
| Complete institutional thesis | Outside intended scope | No full TeX engine, bibliography/index pipeline, chapter project, or compliance templates |

Illustrative targets of roughly 2–12 pages help define acceptance fixtures; they are not application limits. Small page count does not eliminate layout risks: one tall table can still exceed a page.

## Verification results

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm run typecheck` | Pass | Current TypeScript compiles without reported type errors |
| `npm test` | Pass, 89 tests across 8 files | Existing unit assertions pass; some error-path console messages are intentional |
| `npm run test:e2e` | Pass | Workspace authoring, visual equations, styles, images, tables, references, recovery, packages, export preparation, scrolling, and a 650px dialog scenario |
| `npm run test:pages` | Pass | Local production Pages build, subpath assets, autosave, already-loaded offline editing/export, PDF generation, package download; no app backend request |
| `npm run build:pages` | Pass with chunk-size warning | Typecheck and production build, including notices for 18 dependency packages |
| Standard production build | Pass within workspace browser suite | Root-path build and local preview startup |
| `npm run test:coverage` with CI mode | Fail | Missing `@vitest/coverage-v8`; no measured code-coverage percentage available |
| Targeted probes | Defects reproduced | See A-01 through A-09 and saved observation JSON |
| PDF text, dimensions, links, and sampled visual rendering | Pass for inspected samples | Text is extractable, sample page sizes/counts and links exist, sampled pages are legible |
| Coverage validator | Pass, zero missing or invalid associations | Checks catalogue-to-code/file associations independently of software test coverage |

Environment: Windows, Node **24.19.0**, npm **11.17.0**, installed Playwright Chromium; PDF producer identified as **Skia/PDF m145**. Browser tests override `window.print` and use headless PDF generation. They do not confirm native Save as PDF dialog completion. No live-site deployment or publication was performed. The app was tested through local builds; browser engines other than the installed Chromium were not evaluated. VS Code's Problems panel was not inspected; the available diagnostic evidence is the typecheck/build output.

The inspected technical-report PDF has **3 Letter pages**, **54,999 bytes**, **4 link annotations**, and extractable text. All three pages were rendered and visually inspected. The simple equation report has **1 Letter page**, with its page visually inspected. The combined sample has **7 pages**, mixing Letter and A4, with **8 link annotations**; its structure and text were inspected, not every page visually. The test fixture's embedded figure is a deliberately tiny image, so the review does not establish photographic/diagram fidelity. Generated samples are untagged; no accessible-PDF claim is warranted. Equation text extraction loses mathematical layout, even when the equation looks correct.

## Findings and repair priorities

Priority meanings: **P1** should be addressed before relying on this app for important drafts or externally supplied content; **P2** is a material correctness/usability gap; **P3** is maintenance or clarity work. “Reproduced” means a local browser probe or command observed the behaviour. “Inspected” means the implementation establishes the behaviour without a complete native-user test.

### A-01 Imported code text can become executable HTML

**Priority P1 · Reproduced · UC-02, UC-11, UC-35**

`renderMarkdown` sanitises parsed HTML, but `renderMath` subsequently reads text nodes, replaces dollar-delimited portions, and writes the whole resulting string through `innerHTML`. Literal HTML that was safely represented as text is therefore parsed again. The traversal also enters code elements. A local code sample containing an image event handler and `$x$` executed a harmless marker assignment: the page's `data-audit-injection` became `1`, and an executable `onerror` attribute remained in the preview.

This breaks the promise of safely previewing another person's Markdown. Code executing in the app origin could interact with that origin's document storage; this audit demonstrated execution only, and did not read, transmit, or modify real user documents.

**Repair:** Render only the math tokens produced by the Markdown parser. Remove the broad HTML/text fallback, or replace it with text-node-safe construction that never reparses surrounding text and excludes code/already-rendered math. Ensure every rendering route, including print preparation and output checks, preserves sanitisation.

**Acceptance:** Run the benign probe through inline code, fenced code, ordinary escaped text, preview, checks, and export. No executable element/attribute should emerge and no marker should execute. Valid equations must still render. Evidence: [katex renderer](../src/katex.ts), `renderMath`/`getTextNodes`; [Markdown renderer](../src/markdown.ts), `renderMarkdown`.

### A-02 Literal code and escaped currency are interpreted as mathematics

**Priority P1 · Reproduced · UC-04, UC-11, UC-12**

The same fallback reprocesses dollar signs after Markdown has already decided whether they are code or escaped text. The literal code sample `Example $x$ must remain literal` contains a rendered KaTeX node. Source with escaped currency signs for 5 and 10 loses its intended wording and displays as `Prices are 5and10.` in the probe.

**Repair:** Respect tokenisation and escaping throughout the pipeline. Cover single/double-dollar code samples, tilde/backtick fences, currency, and adjacent valid math.

**Acceptance:** Code content and escaped currency survive source-to-preview-to-PDF unchanged; only actual math tokens become equations. Evidence: [katex.ts](../src/katex.ts), the fallback passes following placeholder rendering; `codeMath` and `escapedDollars` in recorded probes.

### A-03 Closing removes the only locally saved draft

**Priority P1 · Reproduced · UC-05, UC-07, UC-08, UC-37**

Close immediately splices the document from the workspace. The next autosave persists the smaller document list. There is no close warning, closed-document recovery, or external-save tracking. After closing an edited first document and reloading, the probe retained only the unrelated blank second document.

**Repair:** Provide a recoverable closed-document store or explicitly protect drafts without a durable external copy. Distinguish “saved in this workspace” from “downloaded backup.”

**Acceptance:** Closing the only copy cannot irreversibly discard it through an ordinary click. Recovery must survive reload. Until repaired, use Save or Save package before Close. Evidence: [main.ts](../src/main.ts), `closeDocument`, `scheduleSave`, `flushSave`; [ui.ts](../src/ui.ts), `renderDocumentList`.

### A-04 Switching documents clears undo history

**Priority P2 · Reproduced · UC-05, UC-28**

`MarkdownEditor.setContent` clears both history stacks. Document switching always calls it. The probe edited a document, switched away and back, and found Ctrl+Z left the text unchanged.

**Repair:** Keep history per managed document, or make a deliberate documented product choice that clearly communicates the boundary. Retain the existing size/count bounds.

**Acceptance:** Edits in one open document can be undone after switching to another and back, without applying the other document's history. Evidence: [editor.ts](../src/editor.ts), `setContent`; [main.ts](../src/main.ts), `switchActiveDocument`.

### A-05 Table captions disappear without a reference label

**Priority P2 · Reproduced · UC-15**

The table dialog describes the reference label as optional, but `tableMarkdown` writes caption markup only when a label exists. A supplied caption with an empty label vanished from the generated source.

**Repair:** Support a caption independent of referencing, or require a label whenever a caption is supplied and explain why before submission.

**Acceptance:** A user-entered caption is retained or submission clearly requests the missing prerequisite; it is never silently dropped. Evidence: [media-tools.ts](../src/media-tools.ts), `tableMarkdown` and the table form submission.

### A-06 Smaller screens hide document management and outline navigation

**Priority P2 · Reproduced and inspected · UC-05, UC-26, UC-30, UC-33**

At widths at or below 1200px, CSS hides `.document-sidebar`, including Open Files, rename, close, and the outline. There is no alternative document selector. A user can still create or upload documents, but cannot select an earlier open document using the visible controls. The existing small-screen test checks an equation dialog, not completion of the multi-document workflow.

**Repair:** Provide a drawer or compact document/outline selector in the stacked layout.

**Acceptance:** At 1200px, 650px, and a narrow phone viewport, users can switch, rename, close, and navigate existing documents by pointer and keyboard. Evidence: [style.css](../style.css), `@media (max-width: 1200px)`; [index.html](../index.html), sidebar structure.

### A-07 Combined export loses preset-specific table colours

**Priority P2 · Reproduced · UC-19, UC-33**

Most style settings become CSS variables copied into each print section. Preset-specific table backgrounds instead depend on `:root[data-document-preset]`. Print preparation changes that root attribute per document, then restores the active preset. Consequently every section's preset-dependent selectors use the same root value. With an active Simple document, both Technical and Study notes print sections had the default `rgb(242, 244, 247)` table background.

**Repair:** Scope the preset to each print section or express all preset styling through variables copied per section.

**Acceptance:** A combined PDF containing Simple, Technical, and Study notes documents matches each individual preview's table colours with backgrounds enabled. Evidence: [browser-print.ts](../src/browser-print.ts), `prepareBrowserPrint`; [document.ts](../src/document.ts), `applyDocumentStyle`; [style.css](../style.css), root preset selectors.

### A-08 Math SVG mode is misleading

**Priority P2 · Reproduced · UC-25, UC-39**

The visible toggle passes `output: 'svg'` to the installed KaTeX renderer. For a simple expression, the observed output contains HTML and MathML and no SVG. The app has no separate SVG equation renderer. Existing unit tests verify that the option is passed to a mock, rather than that SVG is produced.

**Repair:** Remove/rename the toggle to match supported output, or implement and test a real alternate renderer if it serves a user need. Keep PDF math on the established HTML path.

**Acceptance:** The label describes the actual rendering result; a test examines real output instead of a mocked option. Evidence: [ui.ts](../src/ui.ts), `toggleMathMode`; [katex.ts](../src/katex.ts), `renderMath`; `svgMode` observation.

### A-09 Keyboard editing traps focus and the source has no explicit label

**Priority P2 · Reproduced · UC-29, UC-30**

The editor intercepts every Tab key, including Shift+Tab, and inserts spaces. The probe confirmed focus stayed in `markdownEditor` for both keys. Its nearby heading is not associated through a label or `aria-labelledby`, and no `aria-label` is present. The custom export modal also lacks the focus trapping/restoration provided by native tool dialogs; that part needs a dedicated assistive-technology check.

**Repair:** Provide a documented keyboard escape from indentation mode, preserve a reliable backward-navigation route, explicitly label the editor, and audit export-dialog focus behaviour.

**Acceptance:** A keyboard-only author can enter, edit, leave, and return to the editor and every dialog without a pointer. Screen readers announce a stable source-editor name. Evidence: [editor.ts](../src/editor.ts), `setupEventListeners`; [index.html](../index.html); [ui.ts](../src/ui.ts), export modal methods.

### A-10 Oversized content can be clipped and checks do not stop export

**Priority P2 · Inspected with existing browser coverage for width warnings · UC-15, UC-22, UC-24, UC-31, UC-32**

Tables, figures, code blocks, and display equations are atomic. If one exceeds a page, the paginator puts it on its own page intact. Page containers hide overflow. The preflight reports many overflow conditions, but Start Export remains available even with error-severity issues; the workspace suite itself exports a document set containing reported errors. Generated contents is also an unsplittable navigation block.

**Repair:** Make error-level clipping conspicuous and require an intentional choice to proceed, or implement suitable splitting/scaling for selected content types. Do not imply that keeping a table together guarantees it fits.

**Acceptance:** A table taller than one page, a long code listing, a wide equation, and an excessive contents list cannot silently reach colleagues with missing content. An explicit override, if retained, should describe the consequence. Evidence: [paginator.ts](../src/paginator.ts), `paginate`/`isAtomicElement`; [preflight.ts](../src/preflight.ts), `inspectOutput`; [main.ts](../src/main.ts), `exportDocuments`; [style.css](../style.css).

### A-11 Passing tests leave important quality gates uncovered

**Priority P2 · Reproduced and inspected · UC-38**

The coverage command fails because `@vitest/coverage-v8` is absent. Its configuration also excludes `main.ts`, where orchestration and persistence decisions live. Most pagination tests merely assert at least one page, even when titled as multi-page or splitting tests; they do not establish the advertised layout outcomes. Page tests mock both pagination and math. The Pages workflow runs `test:pages` but omits `test:e2e`. Neither browser suite asserts PDF semantic text, tagging, complete visual fidelity, or all paper/style combinations.

**Repair:** Restore a working coverage command, include meaningful application coverage, add regressions for A-01–A-10, run the workspace suite in CI, and add a small set of real-browser layout/PDF fixtures. Use measurable page counts, content conservation, links, dimensions, and clipping checks. Keep native print testing as a distinct manual task.

**Acceptance:** Coverage reports run reproducibly; each critical defect has a behavioural regression; CI runs both existing browser suites. No coverage percentage or complete-browser-support claim is made before measurement. Evidence: [package.json](../package.json), [vitest.config.ts](../vitest.config.ts), [paginator tests](../tests/paginator.test.ts), [Pages workflow](../.github/workflows/pages.yml).

### A-12 Planning and testing documents contradict the current product

**Priority P3 · Inspected · UC-02, UC-11, UC-32, UC-38, UC-39**

`ProjectPlan.md` says PDF export is not yet implemented in its Phase 1 status, while later sections plan it. `todonowPRD.md` says tests, manual testing, and CI are missing, although all exist. `MANUAL_TESTING.md` expects real SVG output and syntax highlighting; `temp.md` references a removed `export:pdf` command and an older local path. `project-setup.json` and `todo.md` retain earlier phase assertions. The README describes browser “local storage” generally, while workspace records actually use IndexedDB. The export HTML retains obsolete progress prose/elements even though CSS hides them.

**Repair:** Mark historical plans as historical and provide a single current capability/limitations guide with the supported browser-export workflow. Update manual checks from this catalogue and clarify storage terminology.

**Acceptance:** A new user can follow every current setup/export command; no guide promises unsupported SVG, highlighting, or full TeX. Historical completion claims are clearly dated. This audit supplements, rather than silently rewrites, those records.

## Deliberate boundaries and remaining acceptance work

| Area | Current boundary or uncertainty | Use cases |
| --- | --- | --- |
| Import | Markdown and recognised text only; no native DOCX/PDF/CSV conversion | UC-02 |
| Mathematical scope | Typesetting only; no solver, symbolic verification, or full LaTeX document engine | UC-12–UC-14, UC-39 |
| Academic workflow | Manual reading lists; no bibliography/index/footnote or university-template pipeline | UC-03, UC-36 |
| Tables | No merged cells/calculation; add limits of 20 columns and 100 data rows; no multi-page continuation | UC-15, UC-24 |
| Images | Supported raster types; uploaded/pasted images embed; remote images remain external; no compression or crop | UC-16, UC-17 |
| Packages | One document; no whole-workspace archive, preset-library transfer, or total decompressed-size cap | UC-09 |
| Local recovery | No version history, cross-tab conflict resolution, cloud sync, or guarantee after browser-data clearing | UC-07, UC-08, UC-35 |
| Offline | Already-loaded core workflow verified; no cold-start offline install or guaranteed first-use lazy editor | UC-13, UC-35 |
| Print | Browser controls final output; no app-level confirmation of completed saving; native cancellation remains manual | UC-32, UC-34 |
| Page style | Portrait only; equal margins; no Roman numerals, separate cover numbering, or chapter numbering | UC-20–UC-24 |
| Accessibility | Untagged samples; source and keyboard issues; comprehensive screen-reader/touch/contrast assessment outstanding | UC-30, UC-32 |
| Collaboration | File transfer only; no live collaboration, revision diff, review comments, or tracked changes | UC-37 |
| Performance | No measured supported upper bound or interaction latency target; build reports two large chunks | UC-25, UC-38 |
| Storage/resource failures | Error messages inspected; quota exhaustion, huge ZIP expansion, partial downloads, and multi-tab races not exhaustively exercised | UC-08, UC-09, UC-34 |

## Relationship to the original project plan

| Recorded intent | Current evidence and discrepancy | Use cases |
| --- | --- | --- |
| Split editor, live preview, resizable panes, theme, zoom | Present; narrow layout loses sidebar functions | UC-01, UC-25, UC-26, UC-29, UC-30 |
| A4 with configurable margins and font | Extended to five paper sizes and per-document styles | UC-19, UC-20 |
| Inline/display math and matrix row breaks | Present; code/escape handling fails; SVG toggle inaccurate | UC-11–UC-14, UC-39 |
| Smart page breaks | Implemented; oversized atomic blocks and long contents can overflow | UC-22, UC-24, UC-31 |
| Markdown upload and save | Present; extended to multiple documents and portable packages | UC-02, UC-05, UC-06, UC-09 |
| Text/vector PDF and HTML math on export | Browser print path and sample PDF text verified | UC-32, UC-33 |
| Preview/PDF page fidelity | Sample paths pass; mixed-preset colour defect and incomplete regression checks remain | UC-19, UC-32, UC-33 |
| Progress, cancellation, failures | Busy state and errors present; former progress/cancel machinery hidden; browser owns cancellation | UC-34, UC-39 |
| Deterministic Chromium, size controls, regression tests | Lockfile/build exist; end-user browser is not pinned; no declared file-size budget or complete fidelity gates | UC-38 |
| No server needed for preview | Current export also runs without an app backend | UC-35, UC-38 |

## How to use and maintain this audit

Read the scenario table in the use-case catalogue first, then use the feature matrix as the checklist for product and acceptance work. Prioritise A-01–A-03, followed by A-04–A-11. After each repair, update the affected use case's current-behaviour paragraph and attach a meaningful regression to its acceptance criteria.

From the repository root, run:

```text
node scripts/check-audit-coverage.mjs
node scripts/audit-probes.mjs
```

The first command validates the documented inventory against the current source snapshot; it does not execute or prove every use case. The second creates an isolated local browser context, runs benign defect probes, and writes current observations under `tmp/audit/`. Its output is observational, not a passing acceptance test: several baseline values intentionally demonstrate failures. It does not edit the user's normal browser workspace. The committed observation files preserve the audited baseline.

When source changes, review and refresh associations deliberately. Do not change evidence merely to make a coverage check green. Generated build/dependency folders, Git internals, and user-specific runtime data are excluded; first-party runtime callables, UI capability families, and tracked supporting repository files are included. Declarations without executable bodies are accounted for through their files and owning workflows. Dormant APIs are explicitly classified as legacy/helper coverage, not invented user-facing functionality.

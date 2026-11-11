# Browser acceptance review — 6 November 2026

The repaired app was exercised through its browser UI against all **39 use cases and user stories**. The tested authoring, import, recovery, diagnostic and layout paths work after the fixes below. **This is not an all-criteria pass:** native PDF saving/cancellation and a small set of input/fault variants remain unverified.

The development app used an OS-selected port, `http://127.0.0.1:50272/`. A separate production build used `http://127.0.0.1:61156/MD2PDF/` and a fresh storage origin. Only task-created documents and servers were modified. Environment: Windows, Chrome (installed version 156.0.8078.81), Node 24.19.0. Browser control used the connected Chrome UI; the two separate Playwright CLI suites were **not** run during this campaign.

The [use-case catalogue](USE_CASES.md) contains each complete user story and acceptance criteria. The [feature matrix](FEATURE_COVERAGE.md) and [function inventory](FUNCTION_COVERAGE.md) remain the exhaustive implementation-to-story mappings. The [live observation log](audit/live-results.json) records individual checks, including the original saved-preset failure and its successful retest. Earlier audit/probe/PDF files remain historical; they are not substituted for current results.

## Repairs made from this live pass

| Finding | Repair | Verification |
| --- | --- | --- |
| Applying a personal preset saved from Technical changed the underlying preset to Custom and lost blue table shading. | Resolve the saved preset's base style when reading layout settings. | Repeated save/apply in Chrome; table header is `rgb(234, 241, 247)`. Component regression covers base style and font preservation. |
| Closing an insertion dialog could reset the source cursor to zero, so the next insertion appeared at the beginning. | Close table/image/equation/reference dialogs before committing the source replacement. | Reference and equation insertion leave the cursor after the inserted text; editing the second of two identical inline images leaves the first intact. Added an E2E cursor assertion (written, not executed by the CLI in this pass). |
| Browser-native rename prompts stalled the automation connection and prevented reliable focus testing. | Replace rename/close prompts with the existing accessible in-app dialog system, including blank-name validation and a Cancel-focused close warning. | Live rename, cancel, duplicate names and active/inactive/last close; component tests check validation and cancellation. This is recorded as a browser-control limitation and usability change, not proof that native prompts fail for ordinary users. |
| Renaming rebuilt the file list and dropped keyboard focus onto the document body. | Preserve the focused file/action across list refresh; use the remaining active document or editor when the file is removed. | Live keyboard rename returns focus to the new Rename button; component regression covers rename and last removal. |
| Vite crashed with `EBUSY` while watching downloaded fixtures temporarily locked by Windows, first in `tmp` and later in the saved audit-fixture folder. | Exclude generated `tmp`, `output`, `coverage` and `docs/audit` directories from development watching. | Restarted on the same test port; repeated an audit-fixture file copy and verified the server still responds. |

## Verdict for every story

“Verified path” means the stated browser observations passed, not that every variant or final PDF has passed. The shared native-print limitation applies to all report scenarios that end in PDF export. “Partial” identifies material acceptance work still open.

| Use case and user-story goal | Live evidence and verdict |
| --- | --- |
| UC-01 — Write an engineering brief for colleagues | **Verified path.** Four-page note with decision, calculation, procedure, table, figure, cover and contents; live preview and output checks succeed. Source/package downloads verified on disk. Final PDF pending. |
| UC-02 — Convert an existing report | **Verified path.** TXT and Markdown multi-upload, unsupported-file rejection, unique duplicate imports, saved-source metadata round trip and active first import. Physical file drag/drop and OS read failure not exercised. |
| UC-03 — Prepare a supervisor update | **Verified path.** Four-page Academic fixture includes two labelled equations, embedded figure, results table, limitations and manual reading links. Output checks clean. Final PDF pending. |
| UC-04 — Share a method handout | **Verified path.** Two-page Study notes handout with worked math, literal code, list, quotation and an intentional page break. Final PDF pending. |
| UC-05 — Organise several documents | **Verified path.** Switching preserves independent sources/styles and histories; imports retain earlier drafts; open files remain reachable at narrow widths. |
| UC-06 — Name and save source | **Verified path.** Blank-name error, Cancel, extension completion, case-insensitive collision handling, preserved rename focus and actual Markdown downloads. Downloads were read from disk because the controller's download-event wait timed out despite successful saving. |
| UC-07 — Close without accidental loss | **Verified path.** Warning explains local-draft/history removal; Cancel retains draft; inactive and active close work; last close clears source, outline and old running text on the fresh production origin. |
| UC-08 — Resume after interruption | **Partial.** Reload restores multiple sources, active document and layout; saved personal preset also survives. Forced quota/denied storage and abrupt-process interruption were not injected live; storage validation/error paths retain unit/source evidence. |
| UC-09 — Transfer a complete document | **Verified path.** Actual downloaded ZIP reopens with embedded PNG and Letter/style settings, including on a fresh production origin. Malformed ZIP, absent manifest/document, bad version, over 1,000 entries and 21 MiB expanded source are rejected. Physical second-PC transfer not performed. |
| UC-10 — Format prose | **Verified path.** All ten text-format buttons, H1–H3 menu, H1–H6 source headings, bold shortcut, lists, links, code and rule. Selection/history are retained in tested paths. |
| UC-11 — Document code and procedures | **Verified path.** Escaped currency and HTML/dollar code remain literal, including a four-backtick fence. A 60-step procedure splits into ordered lists starting 1, 19, 38 and 57 without losing entries. Oversized code is diagnosed. |
| UC-12 — Build an equation from source/templates | **Verified path.** All 12 templates, 10 symbols and four source-structure controls validate and render. Display/inline insertion and labels checked. |
| UC-13 — Edit math visually | **Verified path.** MathLive loads; all five box controls reject empty placeholders; typing and Tab complete a fraction; math keyboard opens/closes; source/visual synchronization works. With the production server stopped before first lazy load, the in-dialog failure message and usable LaTeX insertion fallback were verified. |
| UC-14 — Revise and validate equations | **Verified path.** Preview click edits rather than duplicates an equation. Invalid LaTeX/labels and incomplete boxes disable insertion; retained source can be corrected. |
| UC-15 — Build and revise tables | **Verified path.** Headers/cells, left/right alignment, escaped pipe, caption without label, label addition, row/column add/remove and preview double-click checked. Limits report 100 data rows/20 columns. Oversized table is diagnosed. Center alignment appears in the research fixture. |
| UC-16 — Embed and caption images | **Verified path.** Clipboard PNG and PNG/JPEG/WebP/GIF file choices, width/alt/caption/label, preview editing and the second of duplicate inline images. SVG and a 21 MiB image are rejected. Physical image drag/drop and rapid overlapping file reads not injected live. |
| UC-17 — Use and repair image URLs | **Verified path.** A loaded HTTP image is editable; broken local HTTP URL is diagnosed and blocks printing. Slow remote/cache races retain code/unit evidence, not a separate live pass. |
| UC-18 — Cross-reference objects | **Verified path.** Equation/table/figure labels and reference picker render correct links/numbers; missing and duplicate labels are diagnosed. Reference insertion retains its cursor after repair. |
| UC-19 — Reuse a house style | **Verified path.** All four presets selected; saved Technical preset retains shading after repair; local preset reload/delete and layout Cancel tested. Denied preset storage not injected live. |
| UC-20 — Tune typography and paper | **Verified path.** Font/margin lower and upper quick settings and all five page sizes repaginate. Measured page dimensions: A4 794×1123, Letter 816×1056, Legal 816×1344, Tabloid 1056×1632, A3 1123×1587 CSS pixels. Stored-invalid-value bounds retain unit evidence. |
| UC-21 — Add a cover | **Verified path.** Title/subtitle/author/date cover precedes contents/body with running text and page counts. Extreme cover-length variants not separately exercised live. |
| UC-22 — Generate contents | **Verified path.** Linked contents in engineering note; 70 headings generate 70 valid destinations across a ten-page fixture with no preflight clipping. Final PDF links pending. |
| UC-23 — Add running text and numbering | **Verified path.** Headers, footer page tokens and total page labels match the report. An overlong header produces a blocking clipping error; shortening repairs it. Every numbering-mode combination was not separately exported. |
| UC-24 — Control pagination | **Verified path.** Manual page break, ordered continuation, long contents and a mixed inline-math paragraph. Browser output retains all 60 step markers, 350 prefix words, 350 suffix words and final sentinel over seven pages; preflight clean. Atomic oversized code/table rejected. |
| UC-25 — Inspect pages at useful zoom | **Partial.** Fit Width/Page and upper zoom clamp/disabled button verified. Ctrl+wheel and pointer panning not exercised through this controller. |
| UC-26 — Navigate source and preview | **Verified path.** Outline jumps to the selected source heading, preview object editing selects the correct source, scroll-sync state toggles and source highlighting is visible. Full pointer-scroll timing combinations not exhaustively measured. |
| UC-27 — Find and replace accurately | **Verified path.** Unicode `İ` prefix, Next/Previous wrap, case toggle, single/all replacement and literal `$&` replacement preserve source offsets/content. |
| UC-28 — Undo and redo revisions | **Verified path.** Formatting, switch to another document, switch back, undo and redo retain the correct per-document history. Reload history reset remains documented. |
| UC-29 — Arrange the workspace | **Partial.** Divider Home/End/Left, sidebar, light/dark, Focus/Escape and responsive layout exercised. Pointer divider drag not exercised. |
| UC-30 — Use keyboard and narrow screens | **Partial.** Tab exits editor; dialogs and tools remain within 375px; 1500/1200/650/375 layouts have no body horizontal overflow and retain sidebar/tools. Rename focus repaired. Screen reader, touch and full keyboard traversal of every MathLive menu not performed. |
| UC-31 — Diagnose output before sharing | **Verified path.** Clean/current/all scope plus invalid math, missing/duplicate labels, image failure, horizontal/vertical overflow and running-text clipping. Issue click reaches the correct source after the dialog closes. |
| UC-32 — Export one PDF | **Blocked at native handoff.** Start Export successfully reaches browser printing and changes the title to the document filename. Native Chrome print UI is not exposed in this control surface; no PDF was saved or inspected in this pass. Isolated print-preparation tests pass. |
| UC-33 — Export a combined pack | **Partial.** All-files selection and checks succeed for the mixed-style/size workspace. Combined per-section styles/IDs/dimensions have passing isolated tests. Native combined PDF appearance, dimensions and links remain unverified. |
| UC-34 — Cancel/retry after export failure | **Partial.** Empty workspace, single/all scope, pre-start dismissal/Escape, blocking errors and re-enabled controls verified. Native cancellation/afterprint/repeated native save remain blocked; simulated cleanup/error/repeat preparation tests pass. |
| UC-35 — Work locally and render safely | **Verified path.** No account/backend needed; fresh-origin package transfer; source edits/rendering continue with the production server stopped; unsafe event attributes removed and harmless execution marker absent. No security certification implied. |
| UC-36 — Write an evidence summary | **Verified path.** Research quotation, comparison table, ordinary/reference-style reading links and manual references render. These are not bibliography-manager features. |
| UC-37 — Exchange revisions | **Verified path.** Downloaded source and packages, re-import without overwrite, distinct returned revision and document switching. No files sent to colleagues. |
| UC-38 — Maintain a dependable static app | **Partial.** Typecheck, 132 tests, coverage, both builds, zero-known-vulnerability audit, bundled licenses and live production subpath verified. CLI browser suites and final PDF inspection remain outstanding. |
| UC-39 — Recognise legacy/unsupported paths | **Verified path.** Renamed legacy `.tex` source saves verbatim; current/all PDF export gives a Markdown-only explanation and leaves source intact. No obsolete SVG/progress/job control is shown. |

## Current verification and artifacts

`npm run test:coverage`: **132 passed, 13 files**. Coverage: **57.71% statements, 51.08% branches, 53.19% functions, 61.78% lines**. Browser observations are not included in those unit-coverage percentages. Typecheck, root build and Pages build pass. Both builds still warn about JavaScript chunks over 500 kB. `npm audit --json` reports **0 known vulnerabilities**. Traceability is regenerated and checked against the final files.

These editable fixtures were saved through the app and copied from actual browser downloads:

| Fixture | Editable Markdown | Portable package |
| --- | --- | --- |
| Engineering decision note | [Source](audit/fixtures/engineering-note.md) | [Package](audit/fixtures/engineering-note.md2pdf.zip) |
| Supervisor update | [Source](audit/fixtures/research-update.md) | [Package](audit/fixtures/research-update.md2pdf.zip) |
| Method handout | [Source](audit/fixtures/method-handout.md) | [Package](audit/fixtures/method-handout.md2pdf.zip) |

These are synthetic acceptance examples, not validated engineering results. Four-page counts for the first two and two pages for the handout refer to the tested browser preview. There is deliberately no current-PDF artifact or PDF-pass claim.

The [final workspace screenshot](audit/live-workspace.jpg) and [research preview](audit/research-preview.jpg) record the reviewed browser state. The app remains open on the isolated development URL with the three fixtures, an imported report and a returned revision.

## Remaining acceptance work

1. Native Chrome Save as PDF and cancellation for each fixture and a combined pack. Inspect every page, copied/searchable text, links, paper sizes, table colours and afterprint cleanup. The browser controller times out at this native handoff; inspecting an unrelated native Chrome window did not expose the print preview. No fallback silently substituted a simulated PDF for a native-save result.
2. Physical file/image drag/drop, pointer divider/pan and Ctrl+wheel; screen reader/touch testing.
3. Forced browser-storage denial/quota/abrupt shutdown; first-use image/network race combinations; every extreme style/cover variant. Existing unit/source checks are identified separately from live evidence.
4. Run `npm run test:e2e` and `npm run test:pages` in the usual release environment. This campaign used the connected browser-control surface for UI actions instead of launching those separate automation browsers.

Chrome file uploads initially required enabling the ChatGPT extension's file-URL permission. The user explicitly approved and enabled it. Automatic approval review blocked agent access to `chrome://extensions` (only HTTP/HTTPS navigation permitted), so the user restored it manually after file testing and explicitly confirmed **Restored**. The browser was reconnected and the final app tab retained.

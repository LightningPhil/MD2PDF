# MD2PDF feature and use case coverage

Every row below maps a current capability, option family, failure path, or dormant feature to one or more stories in [the use-case catalogue](USE_CASES.md). The function appendix adds callable-level coverage; it is not a replacement for this user-facing inventory.

**Evidence phases:** Every row was mapped in the [39-story code review](CODE_REVIEW.md). B and R below retain historical baseline evidence; U/S denotes unit tests/source inspection. The subsequent [live browser review](LIVE_REVIEW.md) records current observations for all 39 stories, fixes, and the exact remaining variants. Its live results supersede older “pending” notes below for the paths actually exercised; they do not turn every variant in a row into a pass.

Evidence codes: **B** existing browser suite exercised a representative path; **U** unit tests cover some behaviour; **S** inspected in source; **R** a defect was reproduced by a targeted probe; **G** gap or unsupported workflow. Codes describe evidence for the row, not exhaustive testing of every listed variant. A-xx refers to [audit findings](AUDIT.md). Several variants can share one goal and therefore one use case.

## Documents and durable copies

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-001 | Blank startup, first-edit document creation, New, inherited settings | UC-01, UC-03, UC-04 | main.ts; workspace-tools.ts | B/S; inherited title/header values need review |
| F-002 | Type, paste text, immediate source-to-preview updates, empty document | UC-01, UC-02 | editor.ts; main.ts | B/U |
| F-003 | Single/multiple file picker upload; first imported file activation | UC-02, UC-05 | ui.ts; main.ts; index.html | B/S |
| F-004 | Markdown/text drag and drop onto app | UC-02 | ui.ts | S; images have a separate editor drop handler |
| F-005 | MIME/extension filtering, no valid files, read error, mixed upload | UC-02 | ui.ts | U/S; explicit TXT acceptance and skipped-file feedback |
| F-006 | Open-file list, active indicator, page-count badges, switching | UC-05 | main.ts; ui.ts | U/S; history and narrow access repaired, live verification pending |
| F-007 | Preserve per-document content, settings, cursor, selection, editor scroll | UC-05, UC-08 | main.ts; storage.ts | B/U |
| F-008 | Untitled naming, unique IDs, case-insensitive filename collisions | UC-01, UC-02, UC-05, UC-06 | main.ts | B/S |
| F-009 | Rename prompt, cancel, blank error, extension normalisation | UC-06, UC-37 | main.ts; ui.ts | S |
| F-010 | Close inactive/active/last file, neighbour activation, empty workspace | UC-07 | main.ts; ui.ts | S; explicit close confirmation; no post-close recovery |
| F-011 | Markdown download, filename, success/error notification, URL cleanup | UC-06, UC-37 | ui.ts; main.ts; dialog.ts | B/S; browser owns final saving |
| F-012 | Encode/decode layout metadata; hide valid header; retain malformed source | UC-02, UC-06, UC-08 | document.ts; main.ts | B/U |
| F-013 | Normalise numeric bounds, booleans, enums, accent, text lengths; escape text | UC-06, UC-19, UC-20, UC-35 | document.ts | U/S |
| F-014 | IndexedDB initialisation, workspace validation, read/write transactions | UC-08 | storage.ts | B/U |
| F-015 | Restore documents, active ID, counter, split, sidebar, sync and cursor | UC-08, UC-29 | storage.ts; main.ts; ui.ts | B/U; limited layout variants |
| F-016 | Debounced autosave, revision tracking, saving/saved/error statuses | UC-08 | main.ts; workspace-tools.ts | B/S |
| F-017 | Disable editing during restore, storage unavailable, save failure | UC-08, UC-35 | main.ts; style.css | S; quota failure not exhausted |
| F-018 | Pagehide flush, beforeunload unsaved guard, invalid records/duplicate IDs | UC-08 | main.ts; storage.ts | U/S; abrupt shutdown not guaranteed |
| F-019 | Create single-document ZIP, manifest, Markdown/settings, image extraction | UC-09 | package.ts; workspace-tools.ts | U/S; package round trip and metadata |
| F-020 | Deduplicate embedded raster assets; safe package document filename | UC-09 | package.ts | U/S; deduplication and asset-name collision regression |
| F-021 | Open ZIP, restore image data, settings and filename; unique import | UC-09 | package.ts; main.ts | U/S; exact content/settings round trip |
| F-022 | Bounded ZIP/source/image expansion, manifest/version/document/entry errors; save-button busy state | UC-09 | package.ts; workspace-tools.ts | U/S; streaming limits and count/malformed regressions |
| F-023 | Package limits: one document; external URLs stay external; no preset library | UC-09, UC-17, UC-35 | package.ts | S |

## Prose and mathematical authoring

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-024 | Bold, italic, strike, inline-code toggle; selection and empty placeholder | UC-10, UC-11 | authoring.ts; editor.ts | U |
| F-025 | Toolbar H1–H3; source H1–H6; line-scoped heading formatting | UC-10, UC-22 | authoring.ts; markdown.ts | U/S |
| F-026 | Bullet/numbered/nested lists, quote prefixes, unformat selected lines | UC-10, UC-11 | authoring.ts; markdown.ts | U/S |
| F-027 | GFM source task lists, strikethrough, line breaks, reference-style links | UC-04, UC-10, UC-36 | markdown.ts | U/S; checkboxes not a task app |
| F-028 | Link insertion with selected URL placeholder; horizontal-rule insertion | UC-10, UC-36 | authoring.ts | U/S |
| F-029 | Fenced/inline code, literal HTML and dollar signs, code styling | UC-11, UC-35 | authoring.ts; markdown.ts; katex.ts; style.css | U/S; real KaTeX literal/safe-rendering regressions; no highlighting engine |
| F-030 | Two-space Ctrl/Cmd+] insertion; Tab/Shift+Tab focus traversal; Ctrl/Cmd+B, I, K and Shift+E | UC-10, UC-11, UC-12, UC-30 | editor.ts; authoring.ts | U/S; normal Tab no longer prevented |
| F-031 | Undo/redo; Ctrl/Cmd+Z, Y, Shift+Z; native history events | UC-28 | editor.ts | B/U |
| F-032 | History snapshots/selection, bounded memory, clear redo on new edit | UC-28 | editor.ts | U/S |
| F-033 | Separate history per open document; reload/close discard history; no settings/close undo | UC-05, UC-07, UC-28 | editor.ts; main.ts | U/S; switch, stale content and closed history regressions |
| F-034 | Inline/display dollar math tokenisation, backslashes, matrix row breaks | UC-12, UC-14 | markdown.ts; katex.ts | B/U |
| F-035 | Open equation from selection, cursor, shortcut, preview; update in place | UC-12, UC-14, UC-26 | authoring.ts; navigation.ts | B/U |
| F-036 | Function, fraction, power, subscript, root, sum, integral templates | UC-12 | authoring.ts | S/U; variants enumerated in story |
| F-037 | Limit, derivative, matrix, cases, aligned-equations templates | UC-12, UC-13 | authoring.ts | S/U |
| F-038 | π, θ, α, β, ∞, ×, ≤, ≥, ≠, ± symbol insertions | UC-12 | authoring.ts | S |
| F-039 | Source-cursor fraction/root/power/subscript structures and wrapping | UC-12 | authoring.ts | U/S |
| F-040 | Live KaTeX equation preview, inline/display placement, optional eq label | UC-12, UC-14, UC-18 | authoring.ts | B/U |
| F-041 | Empty/invalid expression, bad label, multiline inline, unfilled-box errors | UC-13, UC-14 | authoring.ts | U/S |
| F-042 | Visual math lazy loading, source disclosure, bidirectional field sync | UC-13, UC-35 | visual-math.ts; main.ts | B/S; cold offline limited |
| F-043 | Visual fraction, root, exponent, subscript, 2 × 2 matrix boxes; Tab | UC-13 | visual-math.ts | B for fraction; S for other structures |
| F-044 | Math virtual keyboard show/hide, smart fences/superscript, close cleanup | UC-13, UC-30 | visual-math.ts | S |
| F-045 | Equation insertion/update range and spacing; cancel and return focus | UC-12, UC-14, UC-28 | authoring.ts | B/U |
| F-046 | Renderer failure preserves safe source; invalid math feedback | UC-14, UC-31, UC-38 | katex.ts; preflight.ts | U/S; actual bundled KaTeX, textContent fallback |
| F-047 | HTML-only math rendering; obsolete SVG control retired; inactive page-count recalculation | UC-25, UC-39 | ui.ts; main.ts; katex.ts | U/S; unsupported SVG claim removed |

## Tables images and references

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-048 | Visual table button replaces original simple snippet insertion | UC-15, UC-39 | media-tools.ts; authoring.ts | B/S; helper snippet still inventoried |
| F-049 | Locate table under cursor; insert/update; preview double-click edit | UC-15, UC-26 | media-tools.ts; navigation.ts | B/U |
| F-050 | Edit heading/data cells; add/remove row/column; minimum one column | UC-15 | media-tools.ts | B/S |
| F-051 | Column left/centre/right alignment; escaped pipes; line-break conversion | UC-15 | media-tools.ts | U/S |
| F-052 | Table caption, optional tab label, numbering; 100-row/20-column add limits | UC-15, UC-18 | media-tools.ts; markdown.ts | U/S; unlabelled caption round trip, add-limit messages |
| F-053 | Image file upload, clipboard paste, editor drop; supported raster types | UC-16 | media-tools.ts | B for upload; S for other routes |
| F-054 | FileReader embedding, 20 MiB limit, unsupported/read-error handling | UC-16 | media-tools.ts | S |
| F-055 | HTTP/HTTPS image URL, data URL validation, image preview/load failure | UC-17 | media-tools.ts | B/S |
| F-056 | Alternative text, width 10–100%, intrinsic dimensions/aspect ratio | UC-16, UC-17 | media-tools.ts; style.css | B/S |
| F-057 | Image caption, optional fig label; generated figure markup and escaping | UC-16, UC-18, UC-35 | media-tools.ts; document.ts | B/U |
| F-058 | Edit HTML figure or Markdown image; preview image click | UC-16, UC-17, UC-26 | media-tools.ts; navigation.ts | U/S; selected repeated image and exact source-range regressions |
| F-059 | Image warming, font-ready refresh, image waiting before checks/print | UC-17, UC-24, UC-31, UC-32 | main.ts; preflight.ts; browser-print.ts | B/S |
| F-060 | Automatic display-equation numbering and independently labelled equations | UC-18 | markdown.ts; document.ts | B/U |
| F-061 | Figure/table numbers, generated captions, document-order updates | UC-15, UC-16, UC-18 | markdown.ts | B/U |
| F-062 | Cross-reference picker, empty-target guidance, valid eq/fig/tab grammar | UC-18 | workspace-tools.ts; document.ts | B/U/S |
| F-063 | Manual object-reference syntax, target resolution, missing/duplicate labels | UC-18, UC-31 | markdown.ts; preflight.ts | B/U |
| F-064 | Reference links and unique post-pagination destinations | UC-18, UC-26, UC-33 | markdown.ts; pages.ts; browser-print.ts | B/U/S |

## Appearance and pagination

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-065 | Simple, Technical, Academic, Study notes and Custom styles | UC-01, UC-03, UC-04, UC-19 | document.ts; layout-tools.ts | B/S |
| F-066 | Save named preset, choose/overwrite/delete personal preset, storage error | UC-19 | layout-tools.ts | U/S; invalid stored preset handling and dialog cancellation |
| F-067 | Independent body/heading serif/sans fonts and accent colour | UC-19, UC-20 | document.ts; style.css | B/S |
| F-068 | Font 10–20px, line 1.2–2.2, paragraph 0.5–1.8em, margins 15–30mm | UC-20 | document.ts; layout-tools.ts | U/S |
| F-069 | A4, Letter, Legal, Tabloid, A3; portrait dimensions; per-document storage | UC-20, UC-33 | document.ts; ui.ts; browser-print.ts | B for A4/Letter; S for other sizes |
| F-070 | Quick Font/Margin/Page controls, custom numeric options, preset-to-custom | UC-20 | ui.ts; main.ts; index.html | B/S |
| F-071 | Cover enable, title/subtitle/author/date, title fallback, omit empty fields | UC-21 | layout-tools.ts; markdown.ts | B/U |
| F-072 | Linked TOC, heading depth/indent, generated IDs, page numbers, page break | UC-22 | markdown.ts; pages.ts | B/U |
| F-073 | Header/footer text and page/total tokens, empty omission | UC-23 | layout-tools.ts; pages.ts | B |
| F-074 | None/simple/total page numbering, cover inclusion, per-document restart | UC-21, UC-23, UC-33 | pages.ts | B/S |
| F-075 | Render math before pagination; CSS measurement; millimetre conversion | UC-20, UC-24, UC-32 | pages.ts; paginator.ts | B/S |
| F-076 | Heading keep-with-next; paragraph/list/container splitting; ordered continuation | UC-11, UC-24 | paginator.ts | U/S; deterministic page count, text conservation and ordered-list tests |
| F-077 | Atomic tables/code/images/figures/rules/SVG/display math; oversized fallback | UC-15, UC-16, UC-24, UC-31 | paginator.ts | U/S; atomic blocks retained; detected clipping blocks print |
| F-078 | Preserve inline math during text splitting; approximate source mapping | UC-24, UC-26 | paginator.ts | S |
| F-079 | Page break button and syntax; empty/repeated breaks; blank preview | UC-01, UC-24 | workspace-tools.ts; markdown.ts; paginator.ts; pages.ts | B/U/S |
| F-080 | Content styles for headings/prose/code/lists/tables/quotes/rules/images | UC-10, UC-11, UC-15, UC-16, UC-20 | style.css | U/S; per-document table colour variable; visual review pending |
| F-081 | White paper, page shadows, fixed dimensions, vertical stacking | UC-20, UC-25, UC-29 | style.css; pages.ts | B/S |

## Workspace review and navigation

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-082 | Fit Width, Fit Page, zoom in/out, 35–300% clamp, readout/disabled controls | UC-25 | ui.ts | S |
| F-083 | Ctrl+wheel zoom, manual panning, return to fit width, resize recalculation | UC-25 | ui.ts; style.css | S |
| F-084 | Source/preview split pointer drag, Left/Right 2%, Home/End 20/80% | UC-29, UC-30 | ui.ts; index.html | S |
| F-085 | Sidebar collapse/expand, stored layout, labels and selection preservation | UC-05, UC-08, UC-29 | ui.ts; main.ts | B/S |
| F-086 | Dark/light theme toggle, persistent preference, white export independent | UC-29 | ui.ts; style.css | S |
| F-087 | Focus/Exit focus, Escape, aria-pressed state, resize refresh | UC-29, UC-30 | workspace-tools.ts; navigation.ts; style.css | B |
| F-088 | Stacked layout at 1200px with reachable scrollable sidebar; tool grids at 650px; responsive dialogs | UC-30 | style.css; ui.ts | S; browser layout verification pending |
| F-089 | Outline H1–H6, empty message, source jump, preview scroll | UC-22, UC-26 | navigation.ts | B |
| F-090 | Click preview source ranges; equation/image edit and table double-click | UC-14, UC-15, UC-16, UC-26 | navigation.ts | B/S |
| F-091 | Editing-block highlight, source offset measurement/cache, resize invalidation | UC-26 | navigation.ts; style.css | B/S |
| F-092 | Two-way scroll synchronisation, toggle, animation scheduling/feedback lock | UC-26 | navigation.ts; workspace-tools.ts | B |
| F-093 | Find UI/shortcuts, selected-text seed, case sensitivity, count, empty query | UC-27 | navigation.ts | B/S |
| F-094 | Next/Previous, wraparound, Enter/Shift+Enter; source/preview matching | UC-27 | navigation.ts | U/S; initial Previous and wraparound regressions |
| F-095 | Replace one/all with literal replacement, undo, close/Escape | UC-27, UC-28 | navigation.ts; editor.ts | U/S; literal and Unicode-offset regressions, undo |
| F-096 | Native tool dialogs, submit/cancel/close, focus return, status errors | UC-14, UC-15, UC-16, UC-19, UC-30 | dialog.ts; authoring.ts | B/S |
| F-097 | Toasts, live save/check status, control names and keyboard navigation | UC-08, UC-30, UC-31, UC-34 | ui.ts; workspace-tools.ts; index.html | U/S; editor label, focus styling, native export dialog, toast roles |

## Diagnostics and PDF production

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-098 | Check output dialog; export-modal checks; current/all scope; fresh-result guard | UC-31 | workspace-tools.ts; main.ts | B |
| F-099 | Invalid KaTeX, unmatched display delimiters; ignore fenced code in checks | UC-14, UC-31 | preflight.ts | U/S; code-token-aware delimiter checks; no complete inline-delimiter check |
| F-100 | Missing/duplicate references, image failure, missing alt | UC-17, UC-18, UC-31 | preflight.ts | B/U |
| F-101 | Vertical/horizontal overflow, wide nested objects, running-text clipping, orphan heading | UC-22, UC-23, UC-24, UC-31 | preflight.ts | U/S; controlled overflow bounds and blocking severity; real metrics pending |
| F-102 | Issue severity, deduplication, filenames, click-to-source/document | UC-31 | preflight.ts; workspace-tools.ts; main.ts | B/S |
| F-103 | No-issues result, checks failed message, image timeout, disposable sandbox | UC-31 | workspace-tools.ts; main.ts; preflight.ts | B/S |
| F-104 | Export modal current filename/count, current/all choice, empty/single constraints | UC-32, UC-33, UC-34 | ui.ts; index.html | U/S; zero/single/multiple and normalized scope tests |
| F-105 | Start, busy state/reentry guard, settings snapshot/content sync, error recovery | UC-32, UC-34 | main.ts; ui.ts | B/S |
| F-106 | Pre-start Close/×/backdrop/Escape; browser cancellation; no preparation cancel | UC-34, UC-39 | ui.ts; main.ts; browser-print.ts | U/S; native dialog state/busy protection; native print manual |
| F-107 | Fresh print DOM, font/image wait, forced HTML math, same pagination engine | UC-32 | browser-print.ts; pages.ts | U/S; actual rendering and PageManager in isolated print preparation |
| F-108 | Per-section styles, named CSS paper sizes, per-document pagination | UC-20, UC-32, UC-33 | browser-print.ts; style.css | U/S; per-section colour variables and size rules |
| F-109 | Combined sequence, collision-free IDs/internal links, one PDF | UC-33 | browser-print.ts | U/S; unique targets and link destinations; no reorder/master TOC |
| F-110 | Print title, browser Save as PDF instructions, background/100% guidance | UC-32 | browser-print.ts; ui.ts; README.md | B/S |
| F-111 | Cleanup afterprint/error, remove prior output, restore root style/title/preset | UC-32, UC-34 | browser-print.ts | U/S; repeat/error/simulated afterprint cleanup |
| F-112 | Non-raster text/math, internal links, dimensions and sampled PDF appearance | UC-32, UC-33 | browser-print.ts; style.css; browser tests | B historical PDF only; current final PDF appearance pending |
| F-113 | Errors block print preparation; warnings remain reviewable | UC-31, UC-32, UC-34 | main.ts; workspace-tools.ts | U/S; invalid equation/reference rejected; actual print DOM inspected |

## Boundaries legacy code and maintenance

| ID | Capability or task and variants | Use cases | Implementation | Evidence and boundary |
| --- | --- | --- | --- | --- |
| F-114 | Local processing, no account/server/document sync, hosting/privacy notice | UC-08, UC-35 | main.ts; storage.ts; README.md | B/S; remote assets still request network |
| F-115 | Already-loaded offline editing/export; bundled math/fonts; lazy visual editor | UC-13, UC-35 | main.ts; visual-math.ts; tests/pages.e2e.mjs | B; cold offline unsupported |
| F-116 | HTML sanitisation, math trust disabled, text escaping and label grammar | UC-02, UC-35 | markdown.ts; katex.ts; document.ts | U/S; post-sanitisation reparse removed, real-renderer regression |
| F-117 | Source/archive/PDF handoff; incoming revision and duplicate filenames | UC-06, UC-09, UC-37 | main.ts; package.ts | B/S; no live collaboration |
| F-118 | Quotations/manual reading lists/links; no citation/bibliography engine | UC-03, UC-36 | markdown.ts; README.md | S/G |
| F-119 | Legacy .tex name/raw save and Markdown-only export rejection | UC-39 | main.ts; browser-print.ts | U/S; TeX rejection test; raw-save inspected |
| F-120 | Retired progress/count/timer/log/cancel APIs, markup and styles | UC-34, UC-38, UC-39 | ui.ts; style.css; index.html | S; removed unsupported job controls |
| F-121 | Editor listener removal/clear/wrap helpers and unused UI getters | UC-10, UC-28, UC-38, UC-39 | editor.ts; ui.ts | U/S; implementation helpers, not extra controls |
| F-122 | Dev server, root preview/build, Pages base path/environment override | UC-38 | vite.config.ts; package.json | B |
| F-123 | Typecheck, unit tests, watch mode, workspace/Pages browser tests | UC-38 | package.json; tests; tsconfig files | B/U; watch not separately exercised |
| F-124 | Working V8 coverage command/configuration across all runtime source | UC-38 | package.json; vitest.config.ts | U; measured partial coverage, see CODE_REVIEW.md |
| F-125 | Pages push/manual workflow, CI concurrency/permissions/build/deploy | UC-38 | .github/workflows/pages.yml | S; both browser suites configured; no deployment or current browser execution |
| F-126 | MIT text, runtime dependency/font notices, recursive notice collection | UC-38 | LICENSE; public; scripts/license-notices.mjs | Build passed; no legal review claimed |
| F-127 | Lockfile/dependency configuration, TS/Vite declarations, Git ignores/attributes | UC-38 | package-lock.json; config files | S/U; pinned patched direct dependencies and compatible transitives; npm audit reports zero |
| F-128 | README, samples, setup metadata, old plans/todo/manual testing/install notes | UC-02, UC-38, UC-39 | repository Markdown; samples; project-setup.json | S; current guidance updated, old plans marked historical |
| F-129 | Contributor instructions, prompt workflows, local agent configuration | UC-38 | .github/instructions; .github/prompts; .codex | S; supporting developer files |
| F-130 | Audit stories, defect probes, evidence, callable/file coverage validation | UC-38 | docs; scripts/audit-probes.mjs; scripts/check-audit-coverage.mjs | Audit support, not application UI |

## Verification sources

| Source | What it covers | Limit |
| --- | --- | --- |
| `tests/authoring.test.ts`, `tests/editor.test.ts` | Formatting, equation location/validation and editor operations | DOM/unit context |
| `tests/markdown.test.ts`, `tests/documents.test.ts` | Parsing, metadata, sanitisation before math, labels, table round trips | Real-renderer tests additionally cover post-sanitisation safety |
| `tests/katex.test.ts` | Actual renderer, literal text, safe fallback, idempotence | HTML renderer only; final PDF appearance deferred |
| `tests/storage.test.ts` | Workspace validation and storage round trips | No complete real-browser quota/crash matrix |
| `tests/pages.test.ts`, `tests/paginator.test.ts` | Page API and basic content handling | Controlled geometry, not browser typography; see pagination-flow tests |
| `tests/pagination-flow.test.ts` | Exact counts, text conservation, lists, breaks, long contents | Controlled measurement adapter, not actual CSS layout |
| `tests/browser-print.test.ts` | Error gating, styles/sizes/links and cleanup | No browser/print dialog launched |
| `tests/package.test.ts`, `tests/navigation.test.ts`, `tests/components.test.ts` | ZIP limits/round trips, literal replacement, isolated UI/media/layout controls | Main app orchestration not executed |
| `tests/workspace.e2e.mjs` | Broad workspace and authoring integration | Chromium only; several controls/options not enumerated |
| `tests/pages.e2e.mjs` | Static Pages loading, already-loaded offline flow, simple PDF | Does not test cold offline startup or live deployment |
| `scripts/audit-probes.mjs` | Focused reproduction of missed defects | Future live observations only; baseline JSON retained |
| `docs/audit/pdf-results.json` | Generated sample sizes/counts/text/link inventory | Headless print output, not full PDF conformance |

All 39 stories are represented above. The generated function appendix and JSON make the implementation-side coverage auditable down to each callable location; support/configuration files are separately mapped to the maintenance story instead of inventing end-user buttons for them.

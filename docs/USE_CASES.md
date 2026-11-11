# MD2PDF use cases for short technical and academic documents

This catalogue describes how an engineer, a report author, and a researcher can produce clear, attractive PDFs with MD2PDF. It covers the current software, including recovery, failure paths, accessibility, and maintenance. Each numbered use case has a user story, a concrete workflow, and acceptance criteria. Features with defects are still covered; coverage does not mean that the acceptance criteria currently pass.

The baseline was commit `10aa70fdd2361587b32b33586a822d344a9700f2`. Current-behaviour notes include the 6 November 2026 repairs. The [live browser review](LIVE_REVIEW.md) records tested paths and remaining variants for every story; the [code-only review](CODE_REVIEW.md) retains the preceding evidence. The [original audit](AUDIT.md) retains historical findings, the [feature matrix](FEATURE_COVERAGE.md) maps capabilities, and the [function inventory](FUNCTION_COVERAGE.md) maps the current source.

## Intended readers and document sizes

| Persona | Typical need | Illustrative document |
| --- | --- | --- |
| Engineering author | Explain a decision, calculation, test, or procedure to colleagues | A 2–8 page design note, calculation sheet, test report, or handover |
| Report converter | Improve the presentation of an existing report without rewriting its substance | A 3–12 page Markdown report with tables and diagrams |
| Researcher or thesis student | Communicate a small piece of research clearly | A 2–10 page supervisor update, method note, literature summary, or study handout |
| Maintainer | Keep these workflows reliable and usable | A tested static website with accurate documentation |

These page ranges are proposed examples, not measured limits. “Nice PDF” means readable typography, consistent structure, legible equations and figures, intentional page breaks, correct references, and no clipped content. The app supplies formatting, not engineering calculation, factual validation, or academic judgement.

Word, PDF, spreadsheet, and full LaTeX documents do not have native import workflows. Extract or convert their content to Markdown or plain text outside MD2PDF first. No bibliography manager, citation style engine, tracked changes, shared editing, or institutional thesis template is implemented.

## Complete document scenarios

| Scenario | Suggested structure | Use cases to combine | Completion condition |
| --- | --- | --- | --- |
| Engineering decision note | Problem, constraints, options table, recommendation, supporting calculation | UC-01, UC-10, UC-12, UC-15, UC-19, UC-24, UC-31, UC-32 | Colleagues can identify the decision and read its evidence in a short PDF |
| Test or investigation report | Purpose, setup image, method, results table, equation, interpretation, next steps | UC-01, UC-15, UC-16, UC-18, UC-20, UC-23, UC-31, UC-32 | Measurements, captions, units, and references remain readable and correct |
| Existing report made presentable | Retained source content, revised headings, consistent styles, repaired figures | UC-02, UC-10, UC-17, UC-19, UC-21, UC-22, UC-27, UC-31, UC-32 | A polished PDF and an editable saved source are both available |
| Supervisor progress update | Research question, work completed, short derivation, results, uncertainties, next experiment | UC-03, UC-13, UC-14, UC-18, UC-19, UC-36, UC-31, UC-32 | Supervisor can review the argument without needing a full thesis project |
| Method or revision handout | Explanation, worked equation, example table, caveats, reading links | UC-04, UC-11, UC-12, UC-13, UC-24, UC-36, UC-32 | A concise, self-contained handout with understandable notation |
| Review meeting pack | Separate decision note, test summary, and action sheet | UC-05, UC-06, UC-33, UC-37 | One combined PDF, with each source retained separately |
| Continue on another computer | Source document, embedded diagrams, layout settings | UC-08, UC-09, UC-35 | Package reopens with content, embedded assets, and settings intact |

## Starting and managing documents

### UC-01 Write an engineering brief

**User story:** As an engineer, I want to write a concise technical brief and see its printed appearance as I work, so that colleagues can understand my recommendation quickly.

**Trigger and precondition:** A decision, calculation, test, or handover needs explanation; the app has finished restoring its workspace.

**Workflow:** Choose New, or type into an empty workspace. Add a title, purpose, assumptions, technical explanation, and conclusion. Use formatting, tables, equations, and figures as needed. Check the paginated preview, save the source, run output checks, and export the current document.

**Acceptance:** The first meaningful edit creates an identifiable open document; source edits update the preview; no content is lost when adding another document; the resulting PDF contains the intended text in order. Test with a 2–4 page note containing a list, equation, and table.

**Current behaviour:** Implemented. New documents inherit the active document's settings, including cover information; review these before reusing a style. Content accuracy remains the author's responsibility.

### UC-02 Convert an existing report

**User story:** As a report author, I want to open an existing Markdown or text report and improve its layout, so that I can distribute a professional PDF without recreating the report.

**Trigger and precondition:** One or more `.md`, `.markdown`, or recognised plain-text files are available.

**Workflow:** Use Upload with single or multiple selection, drop files onto the app, or paste text into the editor. Inspect the imported content and any stored MD2PDF settings. Adjust headings, styles, and assets; save and export.

**Acceptance:** Accepted files open without replacing existing documents; duplicate names become unique; the first imported file becomes active; rejected or unreadable input gives useful feedback. Re-importing saved Markdown restores its layout metadata while hiding recognised metadata from the writing source. Malformed metadata remains intact.

**Current behaviour:** Markdown, .markdown and .txt files are accepted; TXT acceptance is independent of MIME type, and mixed uploads report skipped unsupported files. Word/PDF conversion is external. The unsafe math fallback was removed and regression-tested; full import-to-PDF browser verification is pending.

### UC-03 Prepare a supervisor progress update

**User story:** As a researcher or thesis student, I want to turn a small piece of research into a readable progress report, so that my supervisor can comment on the method and results.

**Trigger and precondition:** Research notes, a few results, and relevant source links are available.

**Workflow:** Create a document with research question, method, results, uncertainties, and next steps. Select the Academic preset; add a cover or contents only when useful. Add labelled equations, figures, and results tables. Include manually written references, check the output, and export.

**Acceptance:** Mathematical notation, evidence, and references are legible; numbering updates after rearrangement; the document is understandable independently of a thesis repository. A 4–6 page example includes two equations, one figure, one table, and a short reading list.

**Current behaviour:** Supported as a short report workflow. The Academic preset does not establish compliance with university submission rules. Full TeX compilation, citation management, and chapter assembly are unavailable.

### UC-04 Create a study or method handout

**User story:** As a technically trained student, I want to explain a method with worked examples in a small PDF, so that I can share or revise the idea without maintaining a full publication project.

**Trigger and precondition:** A concept, derivation, experiment method, or tutorial needs a short explanation.

**Workflow:** Choose Study notes or Simple document. Combine headings, explanations, quotations, lists, inline definitions, display equations, and examples. Insert page breaks between distinct topics and export after checks.

**Acceptance:** A 2–5 page handout retains its reading order; code examples remain literal; equations stay legible; each major topic has an intentional start. The source remains editable after export.

**Current behaviour:** Literal code and escaped currency remain literal in unit and live browser tests. GFM task lists can be authored in source; rendered checkboxes are not an interactive task-management system. The two-page handout preview was checked; final PDF appearance remains unverified.

### UC-05 Organise several open documents

**User story:** As an engineer preparing a review pack, I want to keep several notes open and switch between them, so that I can develop related documents without mixing their content or settings.

**Trigger and precondition:** At least two documents have been created or uploaded.

**Workflow:** Select documents in Open Files, inspect their names and page counts, and switch back after editing. Collapse or expand the sidebar when space is needed. Keep separate paper and style settings for each document.

**Acceptance:** Switching retains each document's latest content, selection, editor scroll position, and layout settings; the active indicator is correct; filenames are unique without regard to letter case; page counts refresh after relevant changes.

**Current behaviour:** Switching retains separate in-memory undo/redo stacks, verified live. Narrow layouts retain a scrollable document list and outline, checked at 1500, 1200, 650 and 375px. Combined export follows document-list order; there is no reorder control. Inactive counts use each document’s settings, including cover-only documents.

### UC-06 Name and save editable source

**User story:** As an author, I want a clearly named editable copy of my report, so that I can archive it, revise it, or send it to a colleague.

**Trigger and precondition:** A document is open or source text has been written.

**Workflow:** Use the document's rename control, enter a descriptive filename, and choose Save. Open the downloaded Markdown later with Upload.

**Acceptance:** Empty rename requests report an error; cancelling rename changes nothing; recognised Markdown extensions are retained and missing extensions are supplied; duplicates receive distinct names. Saved source retains content and normalised settings in the MD2PDF metadata comment. Embedded image data remains present.

**Current behaviour:** Save creates a download; it does not overwrite an original file through a persistent file handle. A saved name does not prove a browser download completed. Ordinary `.txt` names can become `.txt.md`. Legacy `.tex` names are handled separately under UC-39.

### UC-07 Close a document without losing work

**User story:** As an author, I want closing a document to preserve a recoverable copy or clearly explain its removal, so that cleaning up the workspace cannot erase my only draft.

**Trigger and precondition:** An open document is no longer needed on screen.

**Workflow:** Save Markdown or a package first, then close the selected document. When closing the active document, continue in a neighbouring document; when closing the last document, return to an empty workspace.

**Acceptance:** Saved files can be reopened; active selection changes predictably; the last close clears source and preview. For a draft without an external copy, the desired behaviour is a clear warning or a recoverable closed-document store.

**Current behaviour:** Close now asks for confirmation and explicitly explains that it removes the locally saved draft and undo history. Cancel leaves the draft open so the author can Save or Save package. Confirmed close still deletes it; there is no trash or reopen-closed command. This implements the warning alternative in the acceptance criteria, not post-close recovery.

### UC-08 Resume work after reload or interruption

**User story:** As a busy engineer, I want my open drafts and working position restored when I return, so that an interruption does not force me to reconstruct my workspace.

**Trigger and precondition:** Browser storage is available and the workspace has had time to save.

**Workflow:** Edit, wait for Saved locally, then reload. Resume the active document and inspect the other open files. If storage is unavailable or a save fails, use Save or Save package immediately.

**Acceptance:** Open documents, active selection, filenames, content, settings, cursor ranges, editor scroll position, split ratio, sidebar state, and scroll-sync choice restore. Invalid stored documents are filtered, settings normalised, and cursor positions bounded. Storage failures show an actionable status rather than claiming success.

**Current behaviour:** Uses IndexedDB for workspace data; themes and presets use localStorage. Saving is scheduled after about 250ms. Invalid/non-finite cursor data and out-of-range split preferences normalize; keyboard-divider changes schedule saving. Browser-data clearing removes local copies. Undo, focus mode and zoom are not persisted. Multi-tab conflict resolution and abrupt-process recovery are not established.

### UC-09 Move a complete document between computers

**User story:** As an author working on two computers, I want one portable file containing my document, images, and settings, so that I can continue without reconstructing the layout.

**Trigger and precondition:** The current document contains text, settings, and optionally embedded PNG, JPEG, GIF, or WebP images.

**Workflow:** Save package, copy the `.md2pdf.zip` file using a normal file-transfer method, and use Open package in another browser workspace. Continue editing and export again.

**Acceptance:** The ZIP contains a versioned manifest, Markdown, and extracted image assets; repeated identical embedded images are deduplicated. Reopening embeds asset data again and restores settings. Malformed manifests, missing documents, unreadable ZIPs, oversized packages, and excessive image entries produce errors.

**Current behaviour:** Packages hold one document, not the whole workspace, preset library or undo history. Limits are 50 MiB compressed input, 1,000 entries, 64 KiB manifest, 20 MiB Markdown, 20 MiB per extracted image, and 50 MiB total consumed decompressed data/expanded source. Reads stop at limits while inflating; save enforces compatible source/image limits and at most 997 distinct images. Generated asset names avoid source collisions. Remote URLs remain remote; arbitrary external relative-image files are not resolved.

## Writing and technical content

### UC-10 Structure and format prose

**User story:** As a report author, I want common formatting controls and editable Markdown, so that I can make a clear document without memorising every syntax rule.

**Trigger and precondition:** Text is selected or the insertion point is placed in the editor.

**Workflow:** Apply bold, italic, strikethrough, inline code, headings, bullet or numbered lists, block quotes, links, or horizontal rules. Use Ctrl/Cmd+B, I, or K where convenient. Edit the generated source directly.

**Acceptance:** Wrapping and unwrapping emphasis retains useful selection; line-based actions operate on complete selected lines; empty selections get usable placeholders; inserted blocks have correct separation. Nested lists, line breaks, reference-style links, and raw-source headings H1–H6 render.

**Current behaviour:** The heading menu exposes H1–H3; H4–H6 require source editing. Links initially use an example URL that the author must replace. Link destinations and quotations require author review; formatting is not fact checking.

### UC-11 Document code and procedures

**User story:** As an engineer, I want to include commands, configuration snippets, and ordered procedures accurately, so that colleagues can reproduce my work.

**Trigger and precondition:** A report includes literal code or a sequence of steps.

**Workflow:** Insert inline code or a fenced code block, enter the example, and add ordered, unordered, nested, or source-authored task lists. Use Ctrl/Cmd+] for two-space insertion where needed. Review long blocks in the preview.

**Acceptance:** Code retains literal characters, dollar signs, and escaped HTML; numbered-list continuation remains correct across pages; long blocks trigger actionable overflow checks; undo restores insertions.

**Current behaviour:** Code styling has no syntax-highlighting engine. Parser-created math placeholders are rendered; code and escaped text are not reparsed. Tab/Shift+Tab navigate normally and Ctrl/Cmd+] inserts two spaces. Oversized code blocks or indivisible list items stay intact; detected clipping blocks export and requires a manual split or layout change.

### UC-12 Insert mathematical notation from templates

**User story:** As an engineer, I want to insert a readable formula from familiar templates and symbols, so that I can communicate a calculation without learning extensive LaTeX syntax.

**Trigger and precondition:** The document needs an inline definition or displayed equation.

**Workflow:** Open Equation or press Ctrl/Cmd+Shift+E. Choose Function, Fraction, Power, Subscript, Square root, Sum, Integral, Limit, Derivative, Matrix, Cases, or Aligned equations. Adjust values; insert π, θ, α, β, ∞, ×, ≤, ≥, ≠, or ±. Use fraction/root/power/subscript structure buttons at the source cursor. Choose inline or display placement and insert.

**Acceptance:** Templates replace the expression, while structure buttons wrap a selection or insert at the cursor. Live preview matches the chosen placement, surrounding Markdown is separated correctly, and the operation is undoable. Code examples are not selected as editable equations.

**Current behaviour:** Implemented for notation supported by the bundled renderer. It formats expressions; it does not solve or verify them.

### UC-13 Build equations visually

**User story:** As a student or engineer, I want to fill visible fraction, root, exponent, subscript, and matrix boxes, so that I can express mathematics with less source-level editing.

**Trigger and precondition:** The equation dialog is open and its visual editor has loaded.

**Workflow:** Enter notation in the visual field. Add fraction boxes, a root box, exponent or subscript boxes, or a 2 × 2 matrix. Move between placeholders with Tab. Show or hide the math keyboard; expand Edit LaTeX source for direct control.

**Acceptance:** Source, visual field, and KaTeX preview stay synchronised after typing, symbols, templates, and structure changes. Unfilled boxes prevent insertion. Closing hides the virtual keyboard, and reopening edits the intended expression.

**Current behaviour:** Implemented with lazy-loaded MathLive. Templates, controls, visual fraction entry and source synchronization were exercised live. Other matrix sizes can be entered in source. Cold offline loading is not guaranteed; the failed-load message and usable LaTeX fallback were verified with the test server stopped.

### UC-14 Revise and validate an existing equation

**User story:** As an author reviewing a derivation, I want to edit an equation in place and receive useful syntax feedback, so that correcting notation does not duplicate it or damage nearby text.

**Trigger and precondition:** An equation already exists, or a new expression is invalid.

**Workflow:** Place the cursor inside the equation and open Equation, or click its preview. Change the expression, placement, or optional `eq:` label. Correct displayed errors, update, or cancel.

**Acceptance:** The complete original expression and label are replaced exactly once; cancelling changes nothing; empty expressions, invalid KaTeX, incomplete visual boxes, invalid equation labels, and multiline inline expressions cannot be committed. Inline placement disables equation labelling. Invalid directly typed source remains diagnosable by output checks.

**Current behaviour:** Implemented for recognised dollar-delimited expressions. The source editor permits arbitrary text, so dialog validation does not guarantee the whole document is valid.

### UC-15 Present results in a table

**User story:** As an engineer, I want to edit a small results table visually, so that colleagues can compare measurements without reading raw data.

**Trigger and precondition:** A small table is needed or the cursor is in an existing Markdown table.

**Workflow:** Open Table, edit heading and data cells, add or remove rows and columns, and choose left, centre, or right alignment for each column. Add a caption and `tab:` reference label. Update from source selection or double-click the table preview.

**Acceptance:** Values, literal pipes, alignment, and source boundaries survive the round trip; one column remains; headings cannot be removed as a data row. Add operations stop at 20 columns and 100 data rows. Labels validate, and table numbers/references update after movement.

**Current behaviour:** Caption text is now retained even when the optional reference label is blank. Add operations explain the 20-column/100-data-row limits. New rows are appended. There are no merged cells, formulas, sorting, CSV import or automatic multi-page table splitting; detected overflow blocks export.

### UC-16 Embed a diagram or photograph

**User story:** As an engineer, I want to insert a local diagram, screenshot, or photograph with explanatory text, so that the report is understandable and travels with its evidence.

**Trigger and precondition:** A supported image is available as a local file or clipboard item.

**Workflow:** Use Image and choose a file, paste an image into the editor, or drop an image onto the editor. Review the preview, describe it in alternative text, choose a width from 10% to 100%, and add a caption and optional `fig:` label. Click the rendered image to revise it.

**Acceptance:** PNG, JPEG, WebP, and GIF data embed in the source; file-based imports above 20 MiB or unsupported types report errors; dimensions retain aspect ratio; text is escaped; captions and reference labels survive edits and package transfer.

**Current behaviour:** Implemented; editing selects the intended inline image, including repeated identical images. File-load revisions prevent an older read overwriting a newer source. Alternative text is required, but filename-derived text still needs author review. Image drops outside the editor follow the document-upload route. No crop, compression, drawing or plot-generation tool is provided.

### UC-17 Include and repair an image URL

**User story:** As a report converter, I want to use an existing hosted diagram and identify broken image links, so that imported reports retain their illustrations.

**Trigger and precondition:** An HTTP/HTTPS image URL or an existing Markdown image is present.

**Workflow:** Open Image, enter or update the URL, provide alternative text, and set size/caption. Check output. If the image is unavailable, replace the URL or upload a local copy before export or transfer.

**Acceptance:** Only permitted URL forms are accepted through the dialog; failures are visible; loaded images cause pagination to refresh; checks detect missing images and missing alternative text. Export waits for image completion or its timeout.

**Current behaviour:** Remote images require a connection, contact their host and remain URLs in packages. A broken URL may be inserted for later repair, but unloaded images are errors that block print preparation. Standard Markdown images can be converted to figure markup. Preview/file-load races are guarded; real network/cache timing needs live verification.

### UC-18 Number and cross-reference technical objects

**User story:** As a technical author, I want references to equations, figures, and tables to update automatically, so that moving material does not leave misleading numbers in my report.

**Trigger and precondition:** At least one object has a valid `eq:`, `fig:`, or `tab:` label.

**Workflow:** Add labels in object editors, enable automatic display-equation numbering if desired, and use Reference to insert a target. Alternatively type `[@eq:name]`, `[@fig:name]`, or `[@tab:name]`. Rearrange objects and follow the generated links.

**Acceptance:** Each kind numbers in document order; labelled equations receive numbers even when automatic numbering is off; references show the correct type and number; duplicate and missing labels appear in checks. Inserting with no targets gives guidance.

**Current behaviour:** Implemented within a document. No chapter-based numbering, cross-document references, bibliography citations, or automatic section numbering. Figure captions can be numbered without a user label, but selectable cross-reference targets need valid labels.

## Document appearance and page structure

### UC-19 Apply and reuse a house style

**User story:** As an engineer writing recurring reports, I want reusable document styles, so that colleagues receive consistently presented documents.

**Trigger and precondition:** A document is open or a new styled document is being created.

**Workflow:** Open Style & layout; choose Simple document, Technical report, Academic, or Study notes. Adjust settings, save a named personal preset, apply it to another document, or delete a saved preset no longer needed.

**Acceptance:** Built-in typography choices apply predictably; personal presets persist locally; missing preset names and storage failures give feedback; deletion applies only to saved presets. Cancelling the layout dialog does not apply its draft settings to the document.

**Current behaviour:** Saving/deleting personal presets takes effect immediately even if the main dialog is cancelled later. Presets include cover and running text. Invalid preset storage is ignored safely. Mixed-document table backgrounds now use a CSS variable retained separately by each print section.

### UC-20 Tune typography and paper

**User story:** As a report author, I want control of text density and paper size, so that the report is comfortable to read and fits the intended print format.

**Trigger and precondition:** The default appearance needs adjustment.

**Workflow:** Set body and heading fonts independently to serif or sans serif, font size, line spacing, paragraph spacing, margins, and accent colour. Select A4, Letter, Legal, Tabloid, or A3. Use the quick Font/Margin/Page toolbar for common changes.

**Acceptance:** Accepted ranges are 10–20px text, 1.2–2.2 line spacing, 0.5–1.8em paragraph spacing, and 15–30mm equal margins. Invalid stored values normalise. Preview repaginates; only the active document's settings change; paper changes refit the preview width.

**Current behaviour:** All five formats are portrait; landscape and independent side margins are absent. Font sizes are pixels, not points: 16px corresponds to 12pt in CSS print units. Built-in presets are starting points, not standards-compliant templates.

### UC-21 Add a cover page

**User story:** As an author circulating a formal short report, I want a separate title page, so that readers can identify its topic, author, and date immediately.

**Trigger and precondition:** The report benefits from front matter.

**Workflow:** Enable Title page and enter title, subtitle, author, and date in Style & layout. Review the cover before the main content; disable it for a shorter memo.

**Acceptance:** Nonempty fields render as text; blank fields are omitted; a missing title falls back to the first heading or Untitled. The body starts after a page break and metadata text is bounded to 500 characters per field.

**Current behaviour:** Implemented. Date is free text, not an automatically updating date field. The cover participates in normal page numbering and receives running header/footer text. There are no logos, custom cover layouts, or separate cover numbering controls.

### UC-22 Generate a contents page

**User story:** As a researcher sharing a structured note, I want a linked contents page with page numbers, so that my supervisor can jump to the relevant section.

**Trigger and precondition:** The document has Markdown headings.

**Workflow:** Enable Generate a linked table of contents, revise headings, and review the generated contents before the body. Follow its links in preview and PDF.

**Acceptance:** H1–H6 headings appear with indentation; links resolve to the correct heading; page numbers reflect pagination; the contents follows a cover if present and has a break before body text. No contents is generated without headings.

**Current behaviour:** Generated contents navigation can now split between entries while preserving links. There is no depth selector or editable generated TOC. Actual page-number accuracy with a long contents list remains part of live PDF review.

### UC-23 Identify pages with running text

**User story:** As an engineer printing a report, I want headers, footers, and page numbers, so that detached pages remain identifiable.

**Trigger and precondition:** A multi-page document needs context on each sheet.

**Workflow:** Enter header/footer text, optionally containing `{page}` and `{pages}`. Select no page numbers, simple numbers, or Page X of Y. Review all pages, including cover and contents.

**Acceptance:** Tokens are replaced with each document's current and total page counts; empty running text is omitted; page-number choice applies consistently; checks identify horizontally clipped running text.

**Current behaviour:** Implemented. Numbering starts at 1 for each document, including in a combined PDF. There are no Roman numerals, custom starts, odd/even headers, or different first-page settings.

### UC-24 Control page flow

**User story:** As a technical author, I want sensible automatic pagination and explicit breaks, so that explanations and their supporting objects remain readable together.

**Trigger and precondition:** Content spans several pages or a section should start on a fresh page.

**Workflow:** Review automatic flow, keeping headings with following content where possible. Insert Page break or `<!-- pagebreak -->` before an intentional new section. Reduce or split oversized objects manually and recheck.

**Acceptance:** Paragraphs, lists, and eligible containers can split without losing text; ordered-list numbering continues; equations, tables, figures, images, and code blocks remain intact where possible. Leading, trailing, or repeated break markers do not create gratuitous blank pages. Source navigation remains useful after splitting.

**Current behaviour:** Mixed-text paragraph/container splitting now preserves text nodes and formatting. Ordered lists split between items. A block or indivisible item taller than a page stays intact; detected clipping blocks export and asks for manual correction. No complete widow/orphan or publication-layout engine is claimed.

### UC-25 Inspect page appearance at useful zoom levels

**User story:** As an author checking presentation, I want to inspect both whole pages and small details, so that I can spot layout defects before exporting.

**Trigger and precondition:** The preview contains rendered pages.

**Workflow:** Use Fit Width, Fit Page, plus/minus, or Ctrl+mouse wheel over the preview. Scroll vertically and horizontally as needed; resize the window and switch paper sizes.

**Acceptance:** The zoom readout and active fit control match the view; zoom stays within 35%–300%; manual zoom allows panning; returning toward fit width removes unnecessary horizontal scrolling. Paper stays white in both interface themes.

**Current behaviour:** Implemented. Zoom affects viewing, not exported paper dimensions. At very narrow widths the minimum zoom and available space can limit fit; zoom level is not restored after reload.

## Reviewing and navigating source

### UC-26 Move between the source and preview

**User story:** As an author revising a report, I want the outline and rendered content to lead me to the relevant source, so that I can correct a section quickly.

**Trigger and precondition:** Source contains headings or mapped content blocks.

**Workflow:** Select an outline heading, click a preview block, or click equations/images and double-click tables to edit them. Toggle Scroll sync and scroll either source or preview. Follow contents and object-reference links.

**Acceptance:** The relevant source range is selected and highlighted in preview; outline depth reflects H1–H6; empty outlines explain what will appear. Two-way scrolling avoids feedback loops, and switching sync off permits independent scrolling.

**Current behaviour:** Implemented with approximate ranges after pagination and precise mappings for inline images and equations. Generated front matter has no normal source selection. The outline remains available in narrow layouts; actual scroll synchronization and touch behaviour await live review.

### UC-27 Find and replace terminology

**User story:** As an engineer refining a report, I want to find and replace repeated terminology, so that names and units remain consistent.

**Trigger and precondition:** The current document contains a term to review.

**Workflow:** Open Find / replace or use Ctrl/Cmd+F or H. Seed the query from selected single-line text if useful. Toggle Match case, use Next/Previous or Enter/Shift+Enter, replace one occurrence or all, then close with Escape or the close control.

**Acceptance:** Match counts and source selection update; navigation wraps; literal replacement text is preserved; empty/no-match queries are harmless; replace-all is one undoable edit.

**Current behaviour:** The first Previous result, replacement wraparound and case-insensitive Unicode offsets have been repaired and regression-tested. Search covers current source, including markup, URLs and image data. There is no regex, whole-word, semantic or all-documents search; review broad replacements before export.

### UC-28 Recover from editing mistakes

**User story:** As an author, I want to undo and redo writing and tool insertions, so that experimenting with a report does not destroy useful work.

**Trigger and precondition:** The current editor session contains edits.

**Workflow:** Type or use formatting, equations, tables, images, page breaks, or replacement. Use Ctrl/Cmd+Z to undo and Ctrl/Cmd+Y or Shift+Z to redo. Continue editing after an undo.

**Acceptance:** Content and selection restore correctly; a new edit clears the redo branch; toolbar insertions are undoable. History stays bounded at approximately 200 snapshots or 10 million characters, retaining at least one snapshot.

**Current behaviour:** History is kept separately for each open document with the existing per-stack bounds. Switching retains it; reload and confirmed close discard it. Externally replaced content does not reuse stale history. Styles, rename, close and preset changes are not editor-undo operations.

### UC-29 Arrange a comfortable writing workspace

**User story:** As an author writing for an extended period, I want control over workspace space and theme, so that I can concentrate and inspect the document comfortably.

**Trigger and precondition:** The default layout is inconvenient.

**Workflow:** Switch dark/light theme; collapse the sidebar; drag the source/preview divider; use its Left/Right keys or Home/End. Enter Focus mode and leave with Exit focus or Escape from the editor.

**Acceptance:** Divider range is 20%–80%, with 2% keyboard steps; layout and preview adjust on resize. Focus mode hides sidebar/preview while retaining authoring controls. Theme persists separately, and printed pages stay independent of theme.

**Current behaviour:** Keyboard-divider changes schedule autosave. Focus-mode grid rows adapt to stacked layouts; focus mode remains temporary. Keyboard resizing, themes, focus/Escape and responsive layouts were exercised live. Pointer drag remains unverified in this campaign.

### UC-30 Work with a keyboard or smaller display

**User story:** As an author using a keyboard or small laptop, I want every essential task to remain reachable, so that device size or input method does not prevent me from finishing a document.

**Trigger and precondition:** Keyboard-only operation or a viewport at/below 1200px is required.

**Workflow:** Navigate controls and dialogs by keyboard; use advertised shortcuts; cancel with Escape; edit equations in the responsive dialog; switch documents and inspect the outline at narrower widths.

**Acceptance:** Controls have useful names and visible focus; dialogs can be dismissed with focus returned; editor focus can be exited without a pointer; files and outline remain reachable; controls do not overflow the screen. Test 1500px, 1200px, 650px, and a narrow phone viewport.

**Current behaviour:** Code repairs add an explicit editor label, ordinary Tab/Shift+Tab traversal, visible focus rules, reachable narrow-layout document controls, toast roles and a native export dialog with cleanup/focus return. Isolated component tests pass; full browser keyboard, screen-reader, contrast and touch acceptance is pending.

## Checking, exporting, and exchanging work

### UC-31 Diagnose output problems before sharing

**User story:** As an engineer accountable for a report, I want output checks to point me to broken or clipped content, so that colleagues do not receive an obviously defective PDF.

**Trigger and precondition:** A draft is ready for visual review or export.

**Workflow:** Choose Check output, or inspect checks in Export PDF for the current file or all open files. Select an issue to switch to its document and source position, fix it, and run checks again.

**Acceptance:** Checks identify invalid rendered equations, unmatched display delimiters, missing/duplicate references, unloaded images, absent alternative text, clipped headers/footers, blocks wider/taller than the printable area, and stranded final headings. Errors include useful file context; empty results and check failures are clearly distinguished.

**Current behaviour:** Errors now block print preparation after a fresh inspection of actual print DOM. Warnings remain reviewable. Code-token checks ignore multi-backtick spans and long/indented fences. Checks do not validate engineering content, bibliography entries, arbitrary external links or PDF accessibility, and do not detect every unmatched inline delimiter. Slow images may require a retry after the diagnostic timeout.

### UC-32 Export the current report to PDF

**User story:** As an engineer sharing a completed note, I want a PDF that preserves legible text, mathematics, and pagination, so that colleagues can read and search it reliably.

**Trigger and precondition:** A current document is ready, images are available, and checks have been reviewed.

**Workflow:** Choose Export PDF, select Current file, and Start Export. In the browser print dialog choose Save as PDF, disable browser headers/footers, keep scale at 100%, and enable background graphics when desired. Inspect the saved PDF.

**Acceptance:** Print preparation uses HTML math, document-specific dimensions and settings, and unflattened text/DOM. Font/image waits precede pagination. Cover, contents links, references, and page labels survive. After printing or cancellation, temporary output is removed and editing resumes.

**Current behaviour:** The browser owns the destination, filename, confirmation and final PDF; the app cannot confirm it was saved. Print DOM is checked before requesting printing. Live Start Export reached the native print handoff, but the controller could not operate Chrome's print preview. Isolated preparation tests pass; native save/cancel, final PDF appearance, equation extraction and PDF accessibility remain unverified. Historical PDFs are not current evidence.

### UC-33 Export a combined review pack

**User story:** As an engineer organising a review meeting, I want one PDF containing all open notes, so that colleagues receive a convenient reading pack.

**Trigger and precondition:** Multiple Markdown documents are open in the intended sequence.

**Workflow:** Check all documents, choose All open files, and start export. Save the combined PDF and verify document transitions, sizes, running text, and internal links.

**Acceptance:** Each document starts in its own print section; its paper dimensions and CSS variables are retained; identifiers are prefixed to prevent heading/reference collisions between documents. The source workspace remains intact.

**Current behaviour:** Produces one PDF in open-document order; there are no reorder controls. Page numbering and contents restart per document; no master contents is generated. Per-document table colours, sizes and prefixed links are checked in DOM tests. Mixed-size/style PDF appearance must be reverified after these changes.

### UC-34 Cancel, retry, and handle export failures

**User story:** As an author finishing a report, I want an interrupted or failed export to leave my work usable, so that I can correct the problem and try again.

**Trigger and precondition:** The export dialog is open, preparation fails, or the browser print dialog is cancelled.

**Workflow:** Close the export dialog before starting through Close, ×, backdrop, or Escape. If started, cancel in the browser's print dialog. Read preparation errors, correct the cause, and export again.

**Acceptance:** No-document export is disabled; all-files selection is disabled for one document; repeated starts are prevented during preparation. Failure restores buttons and reports the cause. Print cleanup removes temporary DOM/style and restores the document title. Subsequent editing and export work.

**Current behaviour:** No active in-app cancellation exists once preparation starts. Obsolete progress/log/Cancel elements and APIs were removed. Preparation failures, repeated preparation and simulated afterprint cleanup pass isolated tests; native cancellation/afterprint and actual retry remain live acceptance work.

### UC-35 Work locally and handle imported content safely

**User story:** As an engineer working with internal material, I want to understand where my content is processed and avoid executable imported content, so that local document work does not create hidden data exposure.

**Trigger and precondition:** The app has loaded; the author may work offline or import another person's source.

**Workflow:** Use local Markdown and embedded images, save durable copies, and avoid remote assets when offline independence is needed. Review imported content in the same rendering pipeline used by export.

**Acceptance:** Core editing/export preparation can operate without an app backend once required assets are loaded. Workspace storage remains local. HTML and math cannot execute imported scripts or event handlers, including through code samples or post-processing. Browser storage failures are explicit.

**Current behaviour:** The unsafe math fallback was removed; parser-created placeholders, DOMPurify and trust-disabled KaTeX are used, with real-renderer safety regressions. ZIP extraction is bounded and the dependency audit reports zero known vulnerabilities at review time. Remote images still make network requests. There is no service worker/offline installation, encrypted vault, cloud backup or cross-PC sync.

### UC-36 Write a small literature or evidence summary

**User story:** As a researcher, I want to combine short quotations, observations, and reading links, so that I can discuss evidence in a compact PDF.

**Trigger and precondition:** The author already has the sources and has selected material to summarise.

**Workflow:** Write headings by topic, use block quotes for quoted passages, add hyperlinks or reference-style Markdown links, and write a short reference list manually. Use tables to compare studies or design alternatives.

**Acceptance:** Links and quoted formatting survive rendering; the author can revise source details with Find / replace; manual references are readable and distinguishable from figure/table/equation cross-references.

**Current behaviour:** Supported as ordinary authoring. No source retrieval, BibTeX/Biber, CSL formatting, automatic bibliography, footnote workflow, plagiarism check, or reference-manager integration is present. `[@fig:...]`-style object references must not be described as academic citations.

### UC-37 Exchange revisions with a colleague

**User story:** As an engineer collaborating asynchronously, I want to provide a review PDF and editable source, so that a colleague can read the report or produce the next revision.

**Trigger and precondition:** A draft is ready for external review.

**Workflow:** Give the document a revision-specific name, save Markdown or a package, and export PDF. Transfer those files using the team's normal channel. Open the returned revision as another document, switch between versions, apply agreed changes, and save a new revision.

**Acceptance:** Review and editable copies are distinct; opening a returned file does not overwrite another draft; package assets and settings survive handoff. The author checks imported material and retains an external copy before closing older versions.

**Current behaviour:** File-based handoff only. No in-app sending, sharing permissions, simultaneous editing, comments, tracked changes, version diff, conflict resolution, or merge is implemented. Renaming alone does not create a durable revision history.

## Supporting operations and compatibility

### UC-38 Maintain a dependable static application

**User story:** As the maintainer of a tool used by engineers and researchers, I want repeatable checks, accurate documentation, and a licensed static build, so that document workflows remain dependable after changes.

**Trigger and precondition:** A release, dependency change, bug fix, or new capability is proposed.

**Workflow:** Install locked dependencies with `npm ci`; run typecheck, unit tests, both browser suites, and builds. Use watch mode during development and review measured coverage alongside the unexecuted paths. Review sample PDFs, license notices, base-path handling, and the Pages workflow. Update this catalogue and traceability inventory when behaviour changes.

**Acceptance:** Root and Pages builds load bundled assets; static operation requires no app backend; release artifacts include MIT and third-party notices. A change's user story and acceptance criteria remain traceable to implementation and verification. Tests exercise observable behaviour and report actual failures.

**Current behaviour:** Current code passes typecheck, 132 unit/component tests, root and Pages builds, and a zero-known-vulnerability dependency audit. Unit coverage is partial (57.71% statements). All 39 stories have observations in the live browser review, including application orchestration, MathLive and production subpath loading; native PDF and listed variants remain open. Both CLI browser suites are configured in CI but were not run during the connected-browser campaign.

### UC-39 Recognise legacy and unsupported workflows

**User story:** As an author returning to an older project or following old instructions, I want unsupported features to be identified clearly, so that I do not spend time on workflows the current app cannot complete.

**Trigger and precondition:** An old workspace contains `.tex` source, a guide mentions server/CLI export, or a guide mentions the former Math: SVG control.

**Workflow:** Save legacy TeX source separately. Close it before all-files PDF export, or export only a Markdown document. Use the supported HTML math renderer for ordinary work. Follow the current browser-export workflow instead of removed commands.

**Acceptance:** TeX export produces a clear Markdown-only error without destroying the source. Hidden legacy cancellation/progress APIs are not presented as functioning jobs. Math-mode labels accurately describe generated output, and old instructions clearly identify removed functionality.

**Current behaviour:** Legacy .tex filenames/raw save are retained and TeX PDF export is explicitly rejected. No TeX compiler/project workflow exists. The misleading SVG switch and obsolete export job controls/APIs/CSS were removed; HTML KaTeX is the supported renderer. Historical plans are labelled and the current instructions describe browser printing.

## Acceptance campaign

Use the scenarios at the start as realistic document fixtures. Run each with a plain document and with cover/contents enabled where applicable. Include the following deliberate fault variants; they are required acceptance work, not claims that all variants passed this audit.

| Variant | Required outcome | Use cases |
| --- | --- | --- |
| Escaped HTML and dollar signs in code, currency text, unsafe imported HTML | Literal text stays literal and no script runs | UC-02, UC-11, UC-35 |
| Invalid equation, incomplete visual box, invalid/missing/duplicate label | Clear local error with safe source retained | UC-14, UC-18, UC-31 |
| Caption without a table label | Caption retained or an explicit instruction to add a label | UC-15 |
| Oversized table, code listing, equation, image, or contents | Overflow identified before sharing; manual correction succeeds | UC-22, UC-24, UC-31 |
| Broken/slow remote image and cold offline visual editor | Accurate feedback and a usable fallback | UC-13, UC-17, UC-35 |
| Storage denied/full, corrupted saved data, reload, unsaved close | No false save claim; clear recovery path | UC-07, UC-08, UC-09 |
| Document switch followed by undo | History loss corrected or explicitly communicated | UC-05, UC-28 |
| Several paper sizes and styles in one export | Dimensions, colours, links, and numbering remain document-specific | UC-19, UC-20, UC-33 |
| Keyboard-only use and narrow viewport | Editor can be exited and every open document remains reachable | UC-29, UC-30 |
| Native print cancellation, disabled downloads, repeated export | Source remains usable and status is honest | UC-06, UC-32, UC-34 |

The [feature matrix](FEATURE_COVERAGE.md) gives the inverse mapping from each capability to these stories. The machine-readable inventory checks that no application callable or tracked supporting file is left without a use-case association.

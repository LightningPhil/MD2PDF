# MD2PDF function and repository coverage

Working-tree snapshot after code repairs; original baseline: `10aa70fdd2361587b32b33586a822d344a9700f2`. Date: 6 November 2026.

**39 user stories; 130 capability groups; 532 application callables; 847 total first-party callables; 98 repository files. Every item has at least one use-case association.**

This is traceability coverage, not statement/branch coverage or proof that all acceptance criteria pass. The [live review](LIVE_REVIEW.md) records browser evidence and remaining checks; the [code review](CODE_REVIEW.md) and [audit](AUDIT.md) retain earlier findings. Read the [stories](USE_CASES.md) and [capability matrix](FEATURE_COVERAGE.md) before this implementation appendix.

## Inventory method

The TypeScript parser enumerates executable function declarations, expressions, arrows, methods, constructors, and accessors, including anonymous event handlers. Declarations and interfaces without bodies are covered by their owning file. No dependency, generated build, temporary output, Git internal, or user-data files are included. Repository support includes tests, configuration, scripts, sample content, licenses, and contributor instructions.

Named functions have workflow mappings; callbacks inherit their nearest mapped owner unless a more specific mapping applies. Shared constructors and event-wiring methods can serve several stories. The JSON preserves a unique file/line/column key for every callable, including repeated callback names. Dormant helpers are explicitly identified; obsolete SVG and export-job controls have been removed.

Run `node scripts/check-audit-coverage.mjs` from the repository root to detect missing stories, mappings, changed source hashes, missing/new functions, unaccounted files, and broken local documentation links. After source changes, review the ownership mappings in `scripts/update-audit-coverage.mjs`, run that generator, and rerun the validator. New runtime modules require explicit mappings. Passing traceability checks does not run the use cases.

## Application modules

| Module | Named callables | Anonymous callbacks | Use cases |
| --- | --- | --- | --- |
| [src/authoring.ts](../src/authoring.ts) | 7 | 25 | UC-10, UC-11, UC-12, UC-13, UC-14, UC-28, UC-30 |
| [src/browser-print.ts](../src/browser-print.ts) | 2 | 6 | UC-31, UC-32, UC-33, UC-34, UC-39 |
| [src/dialog.ts](../src/dialog.ts) | 6 | 11 | UC-06, UC-07, UC-09, UC-14, UC-15, UC-16, UC-19, UC-30, UC-31 |
| [src/document.ts](../src/document.ts) | 7 | 0 | UC-02, UC-06, UC-08, UC-09, UC-14, UC-15, UC-16, UC-18, UC-19, UC-20, UC-32, UC-35 |
| [src/editor.ts](../src/editor.ts) | 22 | 5 | UC-01, UC-02, UC-05, UC-07, UC-08, UC-10, UC-11, UC-14, UC-15, UC-16, UC-24, UC-26, UC-27, UC-28, UC-30, UC-38, UC-39 |
| [src/katex.ts](../src/katex.ts) | 1 | 1 | UC-11, UC-12, UC-14, UC-35, UC-39 |
| [src/layout-tools.ts](../src/layout-tools.ts) | 7 | 5 | UC-19, UC-20, UC-21, UC-22, UC-23 |
| [src/main.ts](../src/main.ts) | 35 | 35 | UC-01, UC-02, UC-05, UC-06, UC-07, UC-08, UC-09, UC-13, UC-16, UC-17, UC-19, UC-20, UC-24, UC-26, UC-31, UC-32, UC-33, UC-34, UC-35, UC-39 |
| [src/markdown.ts](../src/markdown.ts) | 18 | 11 | UC-10, UC-11, UC-12, UC-14, UC-18, UC-21, UC-22, UC-24, UC-35, UC-36 |
| [src/media-tools.ts](../src/media-tools.ts) | 11 | 33 | UC-15, UC-16, UC-17, UC-30 |
| [src/navigation.ts](../src/navigation.ts) | 13 | 26 | UC-14, UC-15, UC-16, UC-22, UC-26, UC-27, UC-29, UC-30 |
| [src/package.ts](../src/package.ts) | 4 | 7 | UC-09 |
| [src/pages.ts](../src/pages.ts) | 14 | 4 | UC-05, UC-12, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-39 |
| [src/paginator.ts](../src/paginator.ts) | 23 | 8 | UC-11, UC-15, UC-16, UC-20, UC-24, UC-26 |
| [src/preflight.ts](../src/preflight.ts) | 4 | 12 | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31, UC-32 |
| [src/storage.ts](../src/storage.ts) | 5 | 14 | UC-08 |
| [src/ui.ts](../src/ui.ts) | 58 | 44 | UC-01, UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 |
| [src/visual-math.ts](../src/visual-math.ts) | 1 | 9 | UC-13, UC-14, UC-30 |
| [src/workspace-tools.ts](../src/workspace-tools.ts) | 9 | 29 | UC-01, UC-08, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 |

## Every application callable

Line and column identify the audited source snapshot. Each entry has at least one story; shared callbacks can have several.

| Source location | Symbol | Use cases | Classification |
| --- | --- | --- | --- |
| src/authoring.ts:8:1 | `formatSelection` | UC-10, UC-11, UC-28 | application implementation |
| src/authoring.ts:30:20 | `formatSelection.prefix` | UC-10, UC-11, UC-28 | application implementation |
| src/authoring.ts:32:56 | `formatSelection.callback@32:56` | UC-10, UC-11, UC-28 | callback within owning workflow |
| src/authoring.ts:33:28 | `formatSelection.callback@33:28` | UC-10, UC-11, UC-28 | callback within owning workflow |
| src/authoring.ts:52:1 | `equationAt` | UC-14 | application implementation |
| src/authoring.ts:84:3 | `AuthoringTools.constructor` | UC-10, UC-12, UC-14, UC-30 | application implementation |
| src/authoring.ts:101:44 | `AuthoringTools.constructor.callback@101:44` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:102:40 | `AuthoringTools.constructor.callback@102:40` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:106:40 | `AuthoringTools.constructor.callback@106:40` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:115:44 | `AuthoringTools.constructor.callback@115:44` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:116:40 | `AuthoringTools.constructor.callback@116:40` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:140:23 | `AuthoringTools.constructor.callback@140:23` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:146:47 | `AuthoringTools.constructor.callback@146:47` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:155:20 | `AuthoringTools.constructor.callback@155:20` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:156:23 | `AuthoringTools.constructor.callback@156:23` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:157:17 | `AuthoringTools.constructor.callback@157:17` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:158:21 | `AuthoringTools.constructor.callback@158:21` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:160:24 | `AuthoringTools.constructor.callback@160:24` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:165:40 | `AuthoringTools.constructor.callback@160:24.callback@165:40` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:177:21 | `AuthoringTools.constructor.callback@177:21` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:183:40 | `AuthoringTools.constructor.callback@177:21.callback@183:40` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:190:58 | `AuthoringTools.constructor.callback@190:58` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:190:101 | `AuthoringTools.constructor.callback@190:58.callback@190:101` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:191:43 | `AuthoringTools.constructor.callback@191:43` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:192:43 | `AuthoringTools.constructor.callback@192:43` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:193:45 | `AuthoringTools.constructor.callback@193:45` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:194:76 | `AuthoringTools.constructor.callback@194:76` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:195:43 | `AuthoringTools.constructor.callback@195:43` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:196:76 | `AuthoringTools.constructor.callback@196:76` | UC-10, UC-12, UC-14, UC-30 | callback within owning workflow |
| src/authoring.ts:208:3 | `AuthoringTools.open` | UC-12, UC-14 | application implementation |
| src/authoring.ts:222:3 | `AuthoringTools.updatePreview` | UC-13, UC-14 | application implementation |
| src/authoring.ts:243:3 | `AuthoringTools.commit` | UC-12, UC-14 | application implementation |
| src/browser-print.ts:9:1 | `prepareBrowserPrint` | UC-31, UC-32, UC-33, UC-34, UC-39 | application implementation |
| src/browser-print.ts:11:22 | `prepareBrowserPrint.callback@11:22` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/browser-print.ts:22:19 | `prepareBrowserPrint.cleanup` | UC-34 | application implementation |
| src/browser-print.ts:43:69 | `prepareBrowserPrint.callback@43:69` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/browser-print.ts:44:173 | `prepareBrowserPrint.callback@44:173` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/browser-print.ts:47:61 | `prepareBrowserPrint.callback@47:61` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/browser-print.ts:48:75 | `prepareBrowserPrint.callback@48:75` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/browser-print.ts:49:62 | `prepareBrowserPrint.callback@49:62` | UC-31, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/dialog.ts:1:1 | `makeDialog` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | application implementation |
| src/dialog.ts:10:36 | `makeDialog.callback@10:36` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | callback within owning workflow |
| src/dialog.ts:11:45 | `makeDialog.callback@11:45` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | callback within owning workflow |
| src/dialog.ts:12:52 | `makeDialog.callback@12:52` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | callback within owning workflow |
| src/dialog.ts:12:95 | `makeDialog.callback@12:52.callback@12:95` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | callback within owning workflow |
| src/dialog.ts:15:1 | `showDialog` | UC-06, UC-07, UC-14, UC-15, UC-16, UC-19, UC-30 | application implementation |
| src/dialog.ts:20:1 | `dialogError` | UC-06, UC-14, UC-15, UC-16, UC-19, UC-31 | application implementation |
| src/dialog.ts:25:1 | `requestFilename` | UC-06, UC-30 | application implementation |
| src/dialog.ts:29:22 | `requestFilename.callback@29:22` | UC-06, UC-30 | callback within owning workflow |
| src/dialog.ts:31:38 | `requestFilename.callback@29:22.callback@31:38` | UC-06, UC-30 | callback within owning workflow |
| src/dialog.ts:32:37 | `requestFilename.callback@29:22.callback@32:37` | UC-06, UC-30 | callback within owning workflow |
| src/dialog.ts:41:1 | `confirmDocumentClose` | UC-07, UC-30 | application implementation |
| src/dialog.ts:44:22 | `confirmDocumentClose.callback@44:22` | UC-07, UC-30 | callback within owning workflow |
| src/dialog.ts:46:38 | `confirmDocumentClose.callback@44:22.callback@46:38` | UC-07, UC-30 | callback within owning workflow |
| src/dialog.ts:47:37 | `confirmDocumentClose.callback@44:22.callback@47:37` | UC-07, UC-30 | callback within owning workflow |
| src/dialog.ts:52:1 | `downloadBlob` | UC-06, UC-09 | application implementation |
| src/dialog.ts:57:14 | `downloadBlob.callback@57:14` | UC-06, UC-09 | callback within owning workflow |
| src/document.ts:35:17 | `bounded` | UC-06, UC-08, UC-20 | application implementation |
| src/document.ts:36:1 | `normalizeSettings` | UC-06, UC-08, UC-20 | application implementation |
| src/document.ts:53:1 | `decodeDocument` | UC-02, UC-06, UC-09 | application implementation |
| src/document.ts:60:1 | `encodeDocument` | UC-02, UC-06, UC-09 | application implementation |
| src/document.ts:64:1 | `applyDocumentStyle` | UC-19, UC-20, UC-32 | application implementation |
| src/document.ts:76:27 | `escapeHtml` | UC-16, UC-35 | application implementation |
| src/document.ts:77:27 | `validLabel` | UC-14, UC-15, UC-16, UC-18 | application implementation |
| src/editor.ts:13:3 | `MarkdownEditor.constructor` | UC-01, UC-11, UC-28, UC-30 | application implementation |
| src/editor.ts:26:3 | `MarkdownEditor.getContent` | UC-10, UC-14, UC-15, UC-16, UC-26, UC-27 | application implementation |
| src/editor.ts:34:3 | `MarkdownEditor.setContent` | UC-02, UC-05, UC-07, UC-08, UC-28 | application implementation |
| src/editor.ts:48:3 | `MarkdownEditor.setDocumentKey` | UC-02, UC-05, UC-07, UC-08, UC-28 | application implementation |
| src/editor.ts:50:3 | `MarkdownEditor.forgetDocumentHistory` | UC-02, UC-05, UC-07, UC-08, UC-28 | application implementation |
| src/editor.ts:59:3 | `MarkdownEditor.onChange` | UC-01, UC-10 | application implementation |
| src/editor.ts:67:3 | `MarkdownEditor.removeChangeListener` | UC-10, UC-28, UC-38, UC-39 | helper API without current UI call |
| src/editor.ts:77:3 | `MarkdownEditor.focus` | UC-10, UC-14, UC-15, UC-16, UC-26, UC-27 | application implementation |
| src/editor.ts:84:3 | `MarkdownEditor.clear` | UC-10, UC-28, UC-38, UC-39 | helper API without current UI call |
| src/editor.ts:92:3 | `MarkdownEditor.insertText` | UC-10, UC-11, UC-14, UC-15, UC-16, UC-24, UC-27, UC-28 | application implementation |
| src/editor.ts:96:3 | `MarkdownEditor.getSelection` | UC-10, UC-14, UC-15, UC-16, UC-26, UC-27 | application implementation |
| src/editor.ts:100:3 | `MarkdownEditor.setSelection` | UC-10, UC-14, UC-15, UC-16, UC-26, UC-27 | application implementation |
| src/editor.ts:104:3 | `MarkdownEditor.replaceRange` | UC-10, UC-11, UC-14, UC-15, UC-16, UC-24, UC-27, UC-28 | application implementation |
| src/editor.ts:113:3 | `MarkdownEditor.undo` | UC-28 | application implementation |
| src/editor.ts:114:3 | `MarkdownEditor.redo` | UC-28 | application implementation |
| src/editor.ts:116:3 | `MarkdownEditor.snapshot` | UC-28 | application implementation |
| src/editor.ts:120:3 | `MarkdownEditor.recordHistory` | UC-28 | application implementation |
| src/editor.ts:123:35 | `MarkdownEditor.recordHistory.callback@123:35` | UC-28 | callback within owning workflow |
| src/editor.ts:129:3 | `MarkdownEditor.restoreHistory` | UC-28 | application implementation |
| src/editor.ts:142:3 | `MarkdownEditor.getSelectedText` | UC-10, UC-14, UC-15, UC-16, UC-26, UC-27 | application implementation |
| src/editor.ts:150:3 | `MarkdownEditor.wrapSelection` | UC-10, UC-28, UC-38, UC-39 | helper API without current UI call |
| src/editor.ts:160:3 | `MarkdownEditor.setupEventListeners` | UC-01, UC-11, UC-28, UC-30 | application implementation |
| src/editor.ts:162:45 | `MarkdownEditor.setupEventListeners.callback@162:45` | UC-01, UC-11, UC-28, UC-30 | callback within owning workflow |
| src/editor.ts:168:51 | `MarkdownEditor.setupEventListeners.callback@168:51` | UC-01, UC-11, UC-28, UC-30 | callback within owning workflow |
| src/editor.ts:179:47 | `MarkdownEditor.setupEventListeners.callback@179:47` | UC-01, UC-11, UC-28, UC-30 | callback within owning workflow |
| src/editor.ts:197:3 | `MarkdownEditor.notifyChange` | UC-01, UC-10 | application implementation |
| src/editor.ts:199:34 | `MarkdownEditor.notifyChange.callback@199:34` | UC-01, UC-10 | callback within owning workflow |
| src/katex.ts:7:1 | `renderMath` | UC-11, UC-12, UC-14, UC-35, UC-39 | application implementation |
| src/katex.ts:8:101 | `renderMath.callback@8:101` | UC-11, UC-12, UC-14, UC-35, UC-39 | callback within owning workflow |
| src/layout-tools.ts:8:3 | `LayoutTools.constructor` | UC-19, UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/layout-tools.ts:25:72 | `LayoutTools.constructor.callback@25:72` | UC-19, UC-20, UC-21, UC-22, UC-23 | callback within owning workflow |
| src/layout-tools.ts:31:37 | `LayoutTools.constructor.callback@31:37` | UC-19, UC-20, UC-21, UC-22, UC-23 | callback within owning workflow |
| src/layout-tools.ts:36:73 | `LayoutTools.constructor.callback@36:73` | UC-19, UC-20, UC-21, UC-22, UC-23 | callback within owning workflow |
| src/layout-tools.ts:44:75 | `LayoutTools.constructor.callback@44:75` | UC-19, UC-20, UC-21, UC-22, UC-23 | callback within owning workflow |
| src/layout-tools.ts:50:3 | `LayoutTools.open` | UC-19, UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/layout-tools.ts:51:3 | `LayoutTools.input` | UC-19, UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/layout-tools.ts:52:3 | `LayoutTools.fill` | UC-19, UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/layout-tools.ts:61:3 | `LayoutTools.read` | UC-19, UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/layout-tools.ts:72:3 | `LayoutTools.refreshPresetOptions` | UC-19 | application implementation |
| src/layout-tools.ts:74:54 | `LayoutTools.refreshPresetOptions.callback@74:54` | UC-19 | callback within owning workflow |
| src/layout-tools.ts:80:3 | `LayoutTools.persistPresets` | UC-19 | application implementation |
| src/main.ts:40:3 | `MD2PDFApp.constructor` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:47:22 | `MD2PDFApp.constructor.getSettings` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:48:22 | `MD2PDFApp.constructor.setSettings` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:55:22 | `MD2PDFApp.constructor.getFilename` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:56:22 | `MD2PDFApp.constructor.importFiles` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:57:22 | `MD2PDFApp.constructor.newDocument` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:62:22 | `MD2PDFApp.constructor.checkOutput` | UC-31 | application implementation |
| src/main.ts:63:20 | `MD2PDFApp.constructor.goToIssue` | UC-01, UC-08, UC-13, UC-19, UC-35 | application implementation |
| src/main.ts:74:56 | `MD2PDFApp.constructor.callback@74:56` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:75:46 | `MD2PDFApp.constructor.callback@74:56.callback@75:46` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:78:18 | `MD2PDFApp.constructor.callback@74:56.callback@78:18` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:90:100 | `MD2PDFApp.constructor.callback@90:100` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:91:44 | `MD2PDFApp.constructor.callback@91:44` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:92:75 | `MD2PDFApp.constructor.callback@92:75` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:93:78 | `MD2PDFApp.constructor.callback@93:78` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:94:72 | `MD2PDFApp.constructor.callback@94:72` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:95:43 | `MD2PDFApp.constructor.callback@95:43` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:96:47 | `MD2PDFApp.constructor.callback@96:47` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:99:38 | `MD2PDFApp.constructor.callback@99:38` | UC-01, UC-08, UC-13, UC-19, UC-35 | callback within owning workflow |
| src/main.ts:117:3 | `MD2PDFApp.setupEventHandlers` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | application implementation |
| src/main.ts:118:26 | `MD2PDFApp.setupEventHandlers.callback@118:26` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:149:26 | `MD2PDFApp.setupEventHandlers.callback@149:26` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:153:30 | `MD2PDFApp.setupEventHandlers.callback@153:30` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:157:30 | `MD2PDFApp.setupEventHandlers.callback@157:30` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:161:29 | `MD2PDFApp.setupEventHandlers.callback@161:29` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:165:24 | `MD2PDFApp.setupEventHandlers.callback@165:24` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:174:36 | `MD2PDFApp.setupEventHandlers.callback@174:36` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:178:27 | `MD2PDFApp.setupEventHandlers.callback@178:27` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:183:30 | `MD2PDFApp.setupEventHandlers.callback@183:30` | UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-32, UC-33, UC-39 | callback within owning workflow |
| src/main.ts:197:3 | `MD2PDFApp.initializeDocuments` | UC-01, UC-02, UC-05 | application implementation |
| src/main.ts:211:3 | `MD2PDFApp.addUploadedDocuments` | UC-02, UC-09 | application implementation |
| src/main.ts:219:19 | `MD2PDFApp.addUploadedDocuments.callback@219:19` | UC-02, UC-09 | callback within owning workflow |
| src/main.ts:233:3 | `MD2PDFApp.switchActiveDocument` | UC-05, UC-08 | application implementation |
| src/main.ts:256:3 | `MD2PDFApp.renameDocument` | UC-02, UC-06, UC-39 | application implementation |
| src/main.ts:280:3 | `MD2PDFApp.closeDocument` | UC-07 | application implementation |
| src/main.ts:281:49 | `MD2PDFApp.closeDocument.callback@281:49` | UC-07 | callback within owning workflow |
| src/main.ts:288:45 | `MD2PDFApp.closeDocument.callback@288:45` | UC-07 | callback within owning workflow |
| src/main.ts:331:3 | `MD2PDFApp.renderActiveDocument` | UC-01, UC-20, UC-24, UC-26 | application implementation |
| src/main.ts:367:3 | `MD2PDFApp.recomputeInactivePageCounts` | UC-05, UC-20, UC-24 | application implementation |
| src/main.ts:370:28 | `MD2PDFApp.recomputeInactivePageCounts.callback@370:28` | UC-05, UC-20, UC-24 | callback within owning workflow |
| src/main.ts:379:3 | `MD2PDFApp.calculatePageCountForMarkdown` | UC-05, UC-20, UC-24 | application implementation |
| src/main.ts:401:3 | `MD2PDFApp.refreshDocumentList` | UC-05, UC-20, UC-24 | application implementation |
| src/main.ts:402:58 | `MD2PDFApp.refreshDocumentList.callback@402:58` | UC-05, UC-20, UC-24 | callback within owning workflow |
| src/main.ts:413:3 | `MD2PDFApp.buildExportModalContext` | UC-32, UC-33, UC-34 | application implementation |
| src/main.ts:421:3 | `MD2PDFApp.getActiveDocument` | UC-05, UC-08 | application implementation |
| src/main.ts:426:32 | `MD2PDFApp.getActiveDocument.callback@426:32` | UC-05, UC-08 | callback within owning workflow |
| src/main.ts:429:3 | `MD2PDFApp.getDocumentById` | UC-05, UC-08 | application implementation |
| src/main.ts:430:32 | `MD2PDFApp.getDocumentById.callback@430:32` | UC-05, UC-08 | callback within owning workflow |
| src/main.ts:433:3 | `MD2PDFApp.syncActiveDocumentContentFromEditor` | UC-05, UC-08 | application implementation |
| src/main.ts:444:3 | `MD2PDFApp.createDocument` | UC-01, UC-02, UC-05 | application implementation |
| src/main.ts:456:3 | `MD2PDFApp.createDocumentId` | UC-01, UC-02, UC-05 | application implementation |
| src/main.ts:460:3 | `MD2PDFApp.nextUntitledFilename` | UC-01, UC-02, UC-05 | application implementation |
| src/main.ts:466:3 | `MD2PDFApp.makeUniqueFilename` | UC-02, UC-06, UC-39 | application implementation |
| src/main.ts:477:17 | `MD2PDFApp.makeUniqueFilename.callback@477:17` | UC-02, UC-06, UC-39 | callback within owning workflow |
| src/main.ts:478:14 | `MD2PDFApp.makeUniqueFilename.callback@478:14` | UC-02, UC-06, UC-39 | callback within owning workflow |
| src/main.ts:488:3 | `MD2PDFApp.ensureMarkdownFilename` | UC-02, UC-06, UC-39 | application implementation |
| src/main.ts:501:3 | `MD2PDFApp.exportDocuments` | UC-32, UC-33, UC-34 | application implementation |
| src/main.ts:509:56 | `MD2PDFApp.exportDocuments.callback@509:56` | UC-32, UC-33, UC-34 | callback within owning workflow |
| src/main.ts:520:3 | `MD2PDFApp.showError` | UC-02, UC-08, UC-31, UC-34 | application implementation |
| src/main.ts:528:3 | `MD2PDFApp.restoreWorkspace` | UC-08 | application implementation |
| src/main.ts:564:3 | `MD2PDFApp.scheduleSave` | UC-08 | application implementation |
| src/main.ts:569:40 | `MD2PDFApp.scheduleSave.callback@569:40` | UC-08 | callback within owning workflow |
| src/main.ts:572:3 | `MD2PDFApp.flushSave` | UC-08 | application implementation |
| src/main.ts:596:3 | `MD2PDFApp.warmImages` | UC-16, UC-17, UC-24 | application implementation |
| src/main.ts:597:63 | `MD2PDFApp.warmImages.callback@597:63` | UC-16, UC-17, UC-24 | callback within owning workflow |
| src/main.ts:601:22 | `MD2PDFApp.warmImages.callback@597:63.callback@601:22` | UC-16, UC-17, UC-24 | callback within owning workflow |
| src/main.ts:606:3 | `MD2PDFApp.checkOutput` | UC-31 | application implementation |
| src/main.ts:634:65 | `MD2PDFApp.checkOutput.callback@634:65` | UC-31 | callback within owning workflow |
| src/main.ts:643:1 | `pathExtension` | UC-02, UC-06, UC-39 | application implementation |
| src/main.ts:653:49 | `callback@653:49` | UC-01, UC-05, UC-08 | callback within owning workflow |
| src/markdown.ts:23:1 | `createMathToken` | UC-12, UC-14 | application implementation |
| src/markdown.ts:31:1 | `encodeMathForDataAttribute` | UC-12, UC-14 | application implementation |
| src/markdown.ts:38:3 | `start` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:45:3 | `tokenizer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:53:3 | `renderer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:63:3 | `start` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:70:3 | `tokenizer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:82:3 | `renderer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:89:1 | `ensureMarkedConfigured` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | application implementation |
| src/markdown.ts:99:14 | `ensureMarkedConfigured.start` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:100:7 | `ensureMarkedConfigured.tokenizer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:104:7 | `ensureMarkedConfigured.renderer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:109:14 | `ensureMarkedConfigured.start` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:110:7 | `ensureMarkedConfigured.tokenizer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:114:17 | `ensureMarkedConfigured.renderer` | UC-12, UC-18, UC-24 | application implementation |
| src/markdown.ts:127:1 | `renderMarkdown` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | application implementation |
| src/markdown.ts:136:57 | `renderMarkdown.callback@136:57` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | callback within owning workflow |
| src/markdown.ts:141:71 | `renderMarkdown.callback@141:71` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | callback within owning workflow |
| src/markdown.ts:142:107 | `renderMarkdown.callback@142:107` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | callback within owning workflow |
| src/markdown.ts:150:31 | `renderMarkdown.callback@150:31` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | callback within owning workflow |
| src/markdown.ts:155:71 | `renderMarkdown.callback@150:31.callback@155:71` | UC-10, UC-11, UC-12, UC-18, UC-24, UC-35, UC-36 | callback within owning workflow |
| src/markdown.ts:168:1 | `decorateDocument` | UC-18, UC-21, UC-22 | application implementation |
| src/markdown.ts:170:20 | `decorateDocument.register` | UC-18 | application implementation |
| src/markdown.ts:177:20 | `decorateDocument.callback@177:20` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/markdown.ts:179:80 | `decorateDocument.callback@179:80` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/markdown.ts:196:60 | `decorateDocument.callback@196:60` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/markdown.ts:215:82 | `decorateDocument.callback@215:82` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/markdown.ts:224:77 | `decorateDocument.callback@224:77` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/markdown.ts:238:22 | `decorateDocument.callback@238:22` | UC-18, UC-21, UC-22 | callback within owning workflow |
| src/media-tools.ts:7:1 | `tableAt` | UC-15 | application implementation |
| src/media-tools.ts:16:21 | `tableAt.plain` | UC-15 | application implementation |
| src/media-tools.ts:17:143 | `tableAt.callback@17:143` | UC-15 | callback within owning workflow |
| src/media-tools.ts:17:191 | `tableAt.callback@17:191` | UC-15 | callback within owning workflow |
| src/media-tools.ts:23:1 | `tableMarkdown` | UC-15 | application implementation |
| src/media-tools.ts:24:15 | `tableMarkdown.row` | UC-15 | application implementation |
| src/media-tools.ts:24:55 | `tableMarkdown.row.callback@24:55` | UC-15 | callback within owning workflow |
| src/media-tools.ts:25:32 | `tableMarkdown.callback@25:32` | UC-15 | callback within owning workflow |
| src/media-tools.ts:37:3 | `MediaTools.constructor` | UC-15, UC-16, UC-17, UC-30 | application implementation |
| src/media-tools.ts:40:43 | `MediaTools.constructor.callback@40:43` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:50:75 | `MediaTools.constructor.callback@50:75` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:52:50 | `MediaTools.constructor.callback@50:75.callback@52:50` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:54:78 | `MediaTools.constructor.callback@54:78` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:56:32 | `MediaTools.constructor.callback@54:78.callback@56:32` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:60:74 | `MediaTools.constructor.callback@60:74` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:64:75 | `MediaTools.constructor.callback@64:75` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:65:44 | `MediaTools.constructor.callback@65:44` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:66:43 | `MediaTools.constructor.callback@66:43` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:68:21 | `MediaTools.constructor.callback@66:43.value` | UC-15, UC-16, UC-17, UC-30 | application implementation |
| src/media-tools.ts:83:40 | `MediaTools.constructor.callback@83:40` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:85:70 | `MediaTools.constructor.callback@83:40.callback@85:70` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:88:39 | `MediaTools.constructor.callback@88:39` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:90:68 | `MediaTools.constructor.callback@88:39.callback@90:68` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:98:49 | `MediaTools.constructor.callback@98:49` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:99:45 | `MediaTools.constructor.callback@99:45` | UC-15, UC-16, UC-17, UC-30 | callback within owning workflow |
| src/media-tools.ts:102:3 | `MediaTools.openTable` | UC-15 | application implementation |
| src/media-tools.ts:111:3 | `MediaTools.openImage` | UC-16, UC-17 | application implementation |
| src/media-tools.ts:132:38 | `MediaTools.openImage.callback@132:38` | UC-16, UC-17 | callback within owning workflow |
| src/media-tools.ts:151:3 | `MediaTools.drawGrid` | UC-15 | application implementation |
| src/media-tools.ts:155:30 | `MediaTools.drawGrid.callback@155:30` | UC-15 | callback within owning workflow |
| src/media-tools.ts:160:67 | `MediaTools.drawGrid.callback@155:30.callback@160:67` | UC-15 | callback within owning workflow |
| src/media-tools.ts:162:40 | `MediaTools.drawGrid.callback@155:30.callback@162:40` | UC-15 | callback within owning workflow |
| src/media-tools.ts:162:109 | `MediaTools.drawGrid.callback@155:30.callback@162:40.callback@162:109` | UC-15 | callback within owning workflow |
| src/media-tools.ts:166:30 | `MediaTools.drawGrid.callback@166:30` | UC-15 | callback within owning workflow |
| src/media-tools.ts:168:22 | `MediaTools.drawGrid.callback@166:30.callback@168:22` | UC-15 | callback within owning workflow |
| src/media-tools.ts:172:41 | `MediaTools.drawGrid.callback@166:30.callback@168:22.callback@172:41` | UC-15 | callback within owning workflow |
| src/media-tools.ts:177:42 | `MediaTools.drawGrid.callback@166:30.callback@177:42` | UC-15 | callback within owning workflow |
| src/media-tools.ts:182:3 | `MediaTools.loadImage` | UC-16, UC-17 | application implementation |
| src/media-tools.ts:187:45 | `MediaTools.loadImage.callback@187:45` | UC-16, UC-17 | callback within owning workflow |
| src/media-tools.ts:188:58 | `MediaTools.loadImage.callback@187:45.callback@188:58` | UC-16, UC-17 | callback within owning workflow |
| src/media-tools.ts:188:113 | `MediaTools.loadImage.callback@187:45.callback@188:113` | UC-16, UC-17 | callback within owning workflow |
| src/media-tools.ts:196:3 | `MediaTools.previewImage` | UC-16, UC-17 | application implementation |
| src/media-tools.ts:202:20 | `MediaTools.previewImage.callback@202:20` | UC-16, UC-17 | callback within owning workflow |
| src/media-tools.ts:203:21 | `MediaTools.previewImage.callback@203:21` | UC-16, UC-17 | callback within owning workflow |
| src/navigation.ts:4:1 | `sourceOffsetY` | UC-26 | application implementation |
| src/navigation.ts:26:3 | `DocumentNavigation.constructor` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | application implementation |
| src/navigation.ts:31:136 | `DocumentNavigation.constructor.callback@31:136` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:32:65 | `DocumentNavigation.constructor.callback@32:65` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:33:69 | `DocumentNavigation.constructor.callback@33:69` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:34:67 | `DocumentNavigation.constructor.callback@34:67` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:43:43 | `DocumentNavigation.constructor.callback@34:67.callback@43:43` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:47:67 | `DocumentNavigation.constructor.callback@47:67` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:57:66 | `DocumentNavigation.constructor.callback@57:66` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:58:39 | `DocumentNavigation.constructor.callback@58:39` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:62:47 | `DocumentNavigation.constructor.callback@62:47` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:66:91 | `DocumentNavigation.constructor.callback@66:91` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:67:46 | `DocumentNavigation.constructor.callback@67:46` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:67:66 | `DocumentNavigation.constructor.callback@67:46.callback@67:66` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:68:46 | `DocumentNavigation.constructor.callback@68:46` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:68:66 | `DocumentNavigation.constructor.callback@68:46.callback@68:66` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:69:44 | `DocumentNavigation.constructor.callback@69:44` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:73:97 | `DocumentNavigation.constructor.callback@69:44.callback@73:97` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:85:39 | `DocumentNavigation.constructor.callback@85:39` | UC-14, UC-15, UC-16, UC-26, UC-27, UC-29, UC-30 | callback within owning workflow |
| src/navigation.ts:87:3 | `DocumentNavigation.refresh` | UC-22, UC-26, UC-27 | application implementation |
| src/navigation.ts:92:193 | `DocumentNavigation.refresh.callback@92:193` | UC-22, UC-26, UC-27 | callback within owning workflow |
| src/navigation.ts:95:42 | `DocumentNavigation.refresh.callback@92:193.callback@95:42` | UC-22, UC-26, UC-27 | callback within owning workflow |
| src/navigation.ts:103:3 | `DocumentNavigation.openFind` | UC-27 | application implementation |
| src/navigation.ts:110:3 | `DocumentNavigation.goTo` | UC-26 | application implementation |
| src/navigation.ts:116:3 | `DocumentNavigation.mappedBlocks` | UC-26 | application implementation |
| src/navigation.ts:119:3 | `DocumentNavigation.measureOffset` | UC-26 | application implementation |
| src/navigation.ts:123:3 | `DocumentNavigation.highlight` | UC-26 | application implementation |
| src/navigation.ts:126:32 | `DocumentNavigation.highlight.callback@126:32` | UC-26 | callback within owning workflow |
| src/navigation.ts:127:37 | `DocumentNavigation.highlight.callback@127:37` | UC-26 | callback within owning workflow |
| src/navigation.ts:128:61 | `DocumentNavigation.highlight.callback@128:61` | UC-26 | callback within owning workflow |
| src/navigation.ts:132:3 | `DocumentNavigation.schedule` | UC-26 | application implementation |
| src/navigation.ts:135:3 | `DocumentNavigation.syncFromEditor` | UC-26 | application implementation |
| src/navigation.ts:139:40 | `DocumentNavigation.syncFromEditor.callback@139:40` | UC-26 | callback within owning workflow |
| src/navigation.ts:140:44 | `DocumentNavigation.syncFromEditor.callback@140:44` | UC-26 | callback within owning workflow |
| src/navigation.ts:149:3 | `DocumentNavigation.syncFromPreview` | UC-26 | application implementation |
| src/navigation.ts:153:31 | `DocumentNavigation.syncFromPreview.callback@153:31` | UC-26 | callback within owning workflow |
| src/navigation.ts:161:3 | `DocumentNavigation.updateMatches` | UC-27 | application implementation |
| src/navigation.ts:169:77 | `DocumentNavigation.updateMatches.callback@169:77` | UC-27 | callback within owning workflow |
| src/navigation.ts:173:3 | `DocumentNavigation.find` | UC-27 | application implementation |
| src/package.ts:8:1 | `readPackageEntry` | UC-09 | application implementation |
| src/package.ts:13:22 | `readPackageEntry.callback@13:22` | UC-09 | callback within owning workflow |
| src/package.ts:16:23 | `readPackageEntry.callback@13:22.callback@16:23` | UC-09 | callback within owning workflow |
| src/package.ts:24:22 | `readPackageEntry.callback@13:22.callback@24:22` | UC-09 | callback within owning workflow |
| src/package.ts:35:1 | `base64` | UC-09 | application implementation |
| src/package.ts:41:1 | `createPackage` | UC-09 | application implementation |
| src/package.ts:46:50 | `createPackage.callback@46:50` | UC-09 | callback within owning workflow |
| src/package.ts:64:1 | `readPackage` | UC-09 | application implementation |
| src/package.ts:80:50 | `readPackage.callback@80:50` | UC-09 | callback within owning workflow |
| src/package.ts:92:50 | `readPackage.callback@92:50` | UC-09 | callback within owning workflow |
| src/package.ts:100:40 | `readPackage.callback@100:40` | UC-09 | callback within owning workflow |
| src/pages.ts:15:3 | `PageManager.constructor` | UC-24, UC-25 | application implementation |
| src/pages.ts:27:3 | `PageManager.updatePages` | UC-24, UC-25 | application implementation |
| src/pages.ts:42:3 | `PageManager.setMathMode` | UC-12, UC-25, UC-39 | application implementation |
| src/pages.ts:49:3 | `PageManager.getMathMode` | UC-12, UC-25, UC-39 | application implementation |
| src/pages.ts:53:3 | `PageManager.setSettings` | UC-20, UC-21, UC-22, UC-23 | application implementation |
| src/pages.ts:58:3 | `PageManager.getPageCount` | UC-05, UC-24 | application implementation |
| src/pages.ts:65:3 | `PageManager.calculatePageCount` | UC-05, UC-24 | application implementation |
| src/pages.ts:73:3 | `PageManager.clearPages` | UC-24, UC-25 | application implementation |
| src/pages.ts:81:3 | `PageManager.displayPages` | UC-21, UC-22, UC-23, UC-24 | application implementation |
| src/pages.ts:82:24 | `PageManager.displayPages.callback@82:24` | UC-21, UC-22, UC-23, UC-24 | callback within owning workflow |
| src/pages.ts:112:66 | `PageManager.displayPages.callback@112:66` | UC-21, UC-22, UC-23, UC-24 | callback within owning workflow |
| src/pages.ts:117:83 | `PageManager.displayPages.callback@117:83` | UC-21, UC-22, UC-23, UC-24 | callback within owning workflow |
| src/pages.ts:118:97 | `PageManager.displayPages.callback@117:83.callback@118:97` | UC-21, UC-22, UC-23, UC-24 | callback within owning workflow |
| src/pages.ts:143:3 | `PageManager.paginateContent` | UC-24, UC-25 | application implementation |
| src/pages.ts:157:3 | `PageManager.getPageContentHeightPx` | UC-20, UC-24 | application implementation |
| src/pages.ts:164:3 | `PageManager.getPageHeightMm` | UC-20, UC-24 | application implementation |
| src/pages.ts:171:3 | `PageManager.getPageMarginMm` | UC-20, UC-24 | application implementation |
| src/pages.ts:178:3 | `PageManager.mmToPx` | UC-20, UC-24 | application implementation |
| src/paginator.ts:46:1 | `paginate` | UC-24 | application implementation |
| src/paginator.ts:49:55 | `paginate.callback@49:55` | UC-24 | callback within owning workflow |
| src/paginator.ts:126:1 | `isAtomicElement` | UC-11, UC-15, UC-16, UC-24 | application implementation |
| src/paginator.ts:138:1 | `shouldKeepWithNext` | UC-24 | application implementation |
| src/paginator.ts:142:1 | `isSplittableElement` | UC-24 | application implementation |
| src/paginator.ts:163:1 | `splitBlockToFit` | UC-24 | application implementation |
| src/paginator.ts:190:1 | `splitListByItems` | UC-11, UC-24 | application implementation |
| src/paginator.ts:230:1 | `createListFragment` | UC-11, UC-24 | application implementation |
| src/paginator.ts:234:17 | `createListFragment.callback@234:17` | UC-11, UC-24 | callback within owning workflow |
| src/paginator.ts:247:1 | `splitContainerByChildren` | UC-24 | application implementation |
| src/paginator.ts:256:46 | `splitContainerByChildren.callback@256:46` | UC-24 | callback within owning workflow |
| src/paginator.ts:291:1 | `createContainerFragment` | UC-24 | application implementation |
| src/paginator.ts:294:20 | `createContainerFragment.callback@294:20` | UC-24 | callback within owning workflow |
| src/paginator.ts:300:1 | `splitTextElementByWords` | UC-24 | application implementation |
| src/paginator.ts:352:1 | `buildTextSplit` | UC-24 | application implementation |
| src/paginator.ts:377:1 | `mapSplitSource` | UC-24, UC-26 | application implementation |
| src/paginator.ts:394:1 | `collectTextBreakpoints` | UC-24 | application implementation |
| src/paginator.ts:428:1 | `dedupeBreakpoints` | UC-24 | application implementation |
| src/paginator.ts:431:18 | `dedupeBreakpoints.callback@431:18` | UC-24 | callback within owning workflow |
| src/paginator.ts:441:1 | `hasRenderableContent` | UC-24 | application implementation |
| src/paginator.ts:450:1 | `normalizeText` | UC-24 | application implementation |
| src/paginator.ts:454:1 | `fitsOnPage` | UC-24 | application implementation |
| src/paginator.ts:458:1 | `measureBlocksHeight` | UC-24 | application implementation |
| src/paginator.ts:460:18 | `measureBlocksHeight.callback@460:18` | UC-24 | callback within owning workflow |
| src/paginator.ts:466:1 | `getTopLevelElements` | UC-24 | application implementation |
| src/paginator.ts:469:42 | `getTopLevelElements.callback@469:42` | UC-24 | callback within owning workflow |
| src/paginator.ts:481:1 | `isNeutralWrapper` | UC-24 | application implementation |
| src/paginator.ts:485:1 | `createPageContent` | UC-24 | application implementation |
| src/paginator.ts:488:18 | `createPageContent.callback@488:18` | UC-24 | callback within owning workflow |
| src/paginator.ts:494:1 | `createMeasureContainer` | UC-20, UC-24 | application implementation |
| src/paginator.ts:524:1 | `getCssNumericValue` | UC-20, UC-24 | application implementation |
| src/preflight.ts:5:1 | `waitForImages` | UC-17, UC-31, UC-32 | application implementation |
| src/preflight.ts:6:66 | `waitForImages.callback@6:66` | UC-17, UC-31, UC-32 | callback within owning workflow |
| src/preflight.ts:6:130 | `waitForImages.callback@6:66.callback@6:130` | UC-17, UC-31, UC-32 | callback within owning workflow |
| src/preflight.ts:7:20 | `waitForImages.callback@6:66.callback@6:130.finish` | UC-17, UC-31, UC-32 | application implementation |
| src/preflight.ts:12:1 | `inspectOutput` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | application implementation |
| src/preflight.ts:14:15 | `inspectOutput.add` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | application implementation |
| src/preflight.ts:17:22 | `inspectOutput.add.callback@17:22` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:19:61 | `inspectOutput.callback@19:61` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:29:49 | `inspectOutput.callback@29:49` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:32:58 | `inspectOutput.callback@32:58` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:33:72 | `inspectOutput.callback@33:72` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:34:58 | `inspectOutput.callback@34:58` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:38:84 | `inspectOutput.callback@38:84` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:41:63 | `inspectOutput.callback@41:63` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:51:90 | `inspectOutput.callback@41:63.callback@51:90` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/preflight.ts:67:34 | `inspectOutput.callback@67:34` | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31 | callback within owning workflow |
| src/storage.ts:10:1 | `validateWorkspace` | UC-08 | application implementation |
| src/storage.ts:15:18 | `validateWorkspace.finite` | UC-08 | application implementation |
| src/storage.ts:16:42 | `validateWorkspace.callback@16:42` | UC-08 | callback within owning workflow |
| src/storage.ts:19:10 | `validateWorkspace.callback@19:10` | UC-08 | callback within owning workflow |
| src/storage.ts:24:68 | `validateWorkspace.callback@24:68` | UC-08 | callback within owning workflow |
| src/storage.ts:29:3 | `WorkspaceStore.constructor` | UC-08 | application implementation |
| src/storage.ts:30:27 | `WorkspaceStore.constructor.callback@30:27` | UC-08 | callback within owning workflow |
| src/storage.ts:32:33 | `WorkspaceStore.constructor.callback@30:27.callback@32:33` | UC-08 | callback within owning workflow |
| src/storage.ts:33:27 | `WorkspaceStore.constructor.callback@30:27.callback@33:27` | UC-08 | callback within owning workflow |
| src/storage.ts:34:25 | `WorkspaceStore.constructor.callback@30:27.callback@34:25` | UC-08 | callback within owning workflow |
| src/storage.ts:37:3 | `WorkspaceStore.load` | UC-08 | application implementation |
| src/storage.ts:39:24 | `WorkspaceStore.load.callback@39:24` | UC-08 | callback within owning workflow |
| src/storage.ts:41:27 | `WorkspaceStore.load.callback@39:24.callback@41:27` | UC-08 | callback within owning workflow |
| src/storage.ts:42:25 | `WorkspaceStore.load.callback@39:24.callback@42:25` | UC-08 | callback within owning workflow |
| src/storage.ts:45:3 | `WorkspaceStore.save` | UC-08 | application implementation |
| src/storage.ts:47:24 | `WorkspaceStore.save.callback@47:24` | UC-08 | callback within owning workflow |
| src/storage.ts:50:23 | `WorkspaceStore.save.callback@47:24.callback@50:23` | UC-08 | callback within owning workflow |
| src/storage.ts:51:20 | `WorkspaceStore.save.callback@47:24.callback@51:20` | UC-08 | callback within owning workflow |
| src/storage.ts:52:20 | `WorkspaceStore.save.callback@47:24.callback@52:20` | UC-08 | callback within owning workflow |
| src/ui.ts:112:43 | `UIController.onDividerPointerMove` | UC-29, UC-30 | application implementation |
| src/ui.ts:121:41 | `UIController.onDividerPointerUp` | UC-29, UC-30 | application implementation |
| src/ui.ts:131:3 | `UIController.constructor` | UC-01, UC-25, UC-29, UC-30, UC-32 | application implementation |
| src/ui.ts:180:3 | `UIController.onFileUpload` | UC-02 | application implementation |
| src/ui.ts:187:3 | `UIController.onFileSave` | UC-06 | application implementation |
| src/ui.ts:191:3 | `UIController.onExportContextRequest` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:195:3 | `UIController.onExportStart` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:199:3 | `UIController.onDocumentSelect` | UC-05, UC-06, UC-07 | application implementation |
| src/ui.ts:203:3 | `UIController.onDocumentRename` | UC-06 | application implementation |
| src/ui.ts:207:3 | `UIController.onDocumentClose` | UC-07 | application implementation |
| src/ui.ts:214:3 | `UIController.onSettingsChange` | UC-20 | application implementation |
| src/ui.ts:221:3 | `UIController.getPageSize` | UC-20 | application implementation |
| src/ui.ts:233:3 | `UIController.getPageSizeSpec` | UC-20 | application implementation |
| src/ui.ts:237:3 | `UIController.getFontSize` | UC-20 | application implementation |
| src/ui.ts:241:3 | `UIController.getMargin` | UC-20 | application implementation |
| src/ui.ts:245:3 | `UIController.setDocumentPageSettings` | UC-20 | application implementation |
| src/ui.ts:247:44 | `UIController.setDocumentPageSettings.callback@247:44` | UC-20 | callback within owning workflow |
| src/ui.ts:254:3 | `UIController.dismissExportDialog` | UC-34 | application implementation |
| src/ui.ts:256:3 | `UIController.restoreWorkspaceLayout` | UC-08, UC-29 | application implementation |
| src/ui.ts:267:3 | `UIController.refreshPreviewViewport` | UC-25 | application implementation |
| src/ui.ts:277:3 | `UIController.renderDocumentList` | UC-05, UC-06, UC-07 | application implementation |
| src/ui.ts:294:19 | `UIController.renderDocumentList.callback@294:19` | UC-05, UC-06, UC-07 | callback within owning workflow |
| src/ui.ts:318:40 | `UIController.renderDocumentList.callback@294:19.callback@318:40` | UC-05, UC-06, UC-07 | callback within owning workflow |
| src/ui.ts:331:43 | `UIController.renderDocumentList.callback@294:19.callback@331:43` | UC-05, UC-06, UC-07 | callback within owning workflow |
| src/ui.ts:345:42 | `UIController.renderDocumentList.callback@294:19.callback@345:42` | UC-05, UC-06, UC-07 | callback within owning workflow |
| src/ui.ts:358:15 | `UIController.renderDocumentList.callback@358:15` | UC-05, UC-06, UC-07 | callback within owning workflow |
| src/ui.ts:365:3 | `UIController.openExportModal` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:384:27 | `UIController.openExportModal.callback@384:27` | UC-32, UC-33, UC-34 | callback within owning workflow |
| src/ui.ts:393:3 | `UIController.closeExportModal` | UC-34 | application implementation |
| src/ui.ts:405:3 | `UIController.setExportBusy` | UC-34 | application implementation |
| src/ui.ts:422:3 | `UIController.setExportSummary` | UC-34 | application implementation |
| src/ui.ts:429:3 | `UIController.showNotification` | UC-02, UC-06, UC-07, UC-08, UC-30, UC-34 | application implementation |
| src/ui.ts:451:16 | `UIController.showNotification.callback@451:16` | UC-02, UC-06, UC-07, UC-08, UC-30, UC-34 | callback within owning workflow |
| src/ui.ts:456:16 | `UIController.showNotification.callback@456:16` | UC-02, UC-06, UC-07, UC-08, UC-30, UC-34 | callback within owning workflow |
| src/ui.ts:459:18 | `UIController.showNotification.callback@456:16.callback@459:18` | UC-02, UC-06, UC-07, UC-08, UC-30, UC-34 | callback within owning workflow |
| src/ui.ts:465:3 | `UIController.requireElement` | UC-01, UC-25, UC-29, UC-30, UC-32 | application implementation |
| src/ui.ts:473:3 | `UIController.setupEventListeners` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | application implementation |
| src/ui.ts:474:46 | `UIController.setupEventListeners.callback@474:46` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:478:49 | `UIController.setupEventListeners.callback@478:49` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:488:44 | `UIController.setupEventListeners.callback@488:44` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:495:49 | `UIController.setupEventListeners.callback@495:49` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:499:51 | `UIController.setupEventListeners.callback@499:51` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:503:56 | `UIController.setupEventListeners.callback@503:56` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:510:56 | `UIController.setupEventListeners.callback@510:56` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:516:52 | `UIController.setupEventListeners.callback@516:52` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:522:53 | `UIController.setupEventListeners.callback@522:53` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:526:56 | `UIController.setupEventListeners.callback@526:56` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:530:56 | `UIController.setupEventListeners.callback@530:56` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:536:57 | `UIController.setupEventListeners.callback@536:57` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:541:53 | `UIController.setupEventListeners.callback@541:53` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:545:52 | `UIController.setupEventListeners.callback@545:52` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:550:50 | `UIController.setupEventListeners.callback@550:50` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:555:52 | `UIController.setupEventListeners.callback@555:52` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:561:51 | `UIController.setupEventListeners.callback@561:51` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:565:48 | `UIController.setupEventListeners.callback@565:48` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:570:47 | `UIController.setupEventListeners.callback@570:47` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:575:46 | `UIController.setupEventListeners.callback@575:46` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:581:47 | `UIController.setupEventListeners.callback@581:47` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:593:52 | `UIController.setupEventListeners.callback@593:52` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:613:54 | `UIController.setupEventListeners.callback@613:54` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:617:50 | `UIController.setupEventListeners.callback@617:50` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:623:39 | `UIController.setupEventListeners.callback@623:39` | UC-02, UC-05, UC-06, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 | callback within owning workflow |
| src/ui.ts:630:3 | `UIController.applySettings` | UC-20 | application implementation |
| src/ui.ts:640:3 | `UIController.initializeTheme` | UC-29 | application implementation |
| src/ui.ts:653:3 | `UIController.applyTheme` | UC-29 | application implementation |
| src/ui.ts:669:3 | `UIController.toggleTheme` | UC-29 | application implementation |
| src/ui.ts:674:3 | `UIController.toggleSidebar` | UC-05, UC-29 | application implementation |
| src/ui.ts:679:27 | `UIController.toggleSidebar.callback@679:27` | UC-05, UC-29 | callback within owning workflow |
| src/ui.ts:684:3 | `UIController.updateSidebarToggleButton` | UC-05, UC-29 | application implementation |
| src/ui.ts:693:3 | `UIController.normalizeExportContext` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:703:3 | `UIController.applyExportContext` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:718:3 | `UIController.resetExportPanel` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:730:3 | `UIController.getSelectedExportScope` | UC-32, UC-33, UC-34 | application implementation |
| src/ui.ts:734:3 | `UIController.getViewportPaddingPx` | UC-25 | application implementation |
| src/ui.ts:744:3 | `UIController.getViewportInnerSizePx` | UC-25 | application implementation |
| src/ui.ts:752:3 | `UIController.calculateFitWidthZoom` | UC-25 | application implementation |
| src/ui.ts:759:3 | `UIController.calculateFitPageZoom` | UC-25 | application implementation |
| src/ui.ts:771:3 | `UIController.applyPreviewZoom` | UC-25 | application implementation |
| src/ui.ts:807:3 | `UIController.getBasePageSizePx` | UC-25 | application implementation |
| src/ui.ts:827:3 | `UIController.getBaseCanvasSizePx` | UC-25 | application implementation |
| src/ui.ts:839:3 | `UIController.updatePreviewControlState` | UC-25 | application implementation |
| src/ui.ts:852:3 | `UIController.roundZoom` | UC-25 | application implementation |
| src/ui.ts:856:3 | `UIController.mmToPx` | UC-25 | application implementation |
| src/ui.ts:865:3 | `UIController.startDividerDrag` | UC-29, UC-30 | application implementation |
| src/ui.ts:876:3 | `UIController.handleDividerKeyboard` | UC-29, UC-30 | application implementation |
| src/ui.ts:901:3 | `UIController.updateSplitFromPointerX` | UC-29, UC-30 | application implementation |
| src/ui.ts:911:3 | `UIController.setSplitPercent` | UC-29, UC-30 | application implementation |
| src/ui.ts:917:3 | `UIController.isStackedLayout` | UC-29, UC-30 | application implementation |
| src/ui.ts:921:3 | `UIController.isMarkdownFile` | UC-02 | application implementation |
| src/ui.ts:929:3 | `UIController.readFiles` | UC-02 | application implementation |
| src/ui.ts:930:40 | `UIController.readFiles.callback@930:40` | UC-02 | callback within owning workflow |
| src/ui.ts:939:63 | `UIController.readFiles.callback@939:63` | UC-02 | callback within owning workflow |
| src/ui.ts:955:3 | `UIController.readSingleFile` | UC-02 | application implementation |
| src/ui.ts:956:24 | `UIController.readSingleFile.callback@956:24` | UC-02 | callback within owning workflow |
| src/ui.ts:959:23 | `UIController.readSingleFile.callback@956:24.callback@959:23` | UC-02 | callback within owning workflow |
| src/ui.ts:967:24 | `UIController.readSingleFile.callback@956:24.callback@967:24` | UC-02 | callback within owning workflow |
| src/ui.ts:975:3 | `UIController.downloadFile` | UC-06 | application implementation |
| src/ui.ts:989:18 | `UIController.downloadFile.callback@989:18` | UC-06 | callback within owning workflow |
| src/ui.ts:997:3 | `UIController.setupDragAndDrop` | UC-02 | application implementation |
| src/ui.ts:1003:38 | `UIController.setupDragAndDrop.callback@1003:38` | UC-02 | callback within owning workflow |
| src/ui.ts:1007:34 | `UIController.setupDragAndDrop.callback@1007:34` | UC-02 | callback within owning workflow |
| src/ui.ts:1019:3 | `UIController.clamp` | UC-25 | application implementation |
| src/visual-math.ts:8:1 | `installVisualMath` | UC-13, UC-14, UC-30 | application implementation |
| src/visual-math.ts:31:38 | `installVisualMath.callback@31:38` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:41:38 | `installVisualMath.callback@41:38` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:57:35 | `installVisualMath.callback@57:35` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:63:36 | `installVisualMath.callback@63:36` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:64:44 | `installVisualMath.callback@64:44` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:66:73 | `installVisualMath.callback@66:73` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:67:92 | `installVisualMath.callback@67:92` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:67:135 | `installVisualMath.callback@67:92.callback@67:135` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/visual-math.ts:68:36 | `installVisualMath.callback@68:36` | UC-13, UC-14, UC-30 | callback within owning workflow |
| src/workspace-tools.ts:22:3 | `WorkspaceTools.constructor` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | application implementation |
| src/workspace-tools.ts:26:54 | `WorkspaceTools.constructor.callback@26:54` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:26:132 | `WorkspaceTools.constructor.callback@26:132` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:26:157 | `WorkspaceTools.constructor.callback@26:157` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:28:17 | `WorkspaceTools.constructor.add` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | application implementation |
| src/workspace-tools.ts:31:44 | `WorkspaceTools.constructor.add.callback@31:44` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:35:27 | `WorkspaceTools.constructor.callback@35:27` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:36:27 | `WorkspaceTools.constructor.callback@36:27` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:37:18 | `WorkspaceTools.constructor.callback@37:18` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:38:22 | `WorkspaceTools.constructor.callback@38:22` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:39:23 | `WorkspaceTools.constructor.callback@39:23` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:44:25 | `WorkspaceTools.constructor.callback@44:25` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:45:47 | `WorkspaceTools.constructor.callback@45:47` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:48:83 | `WorkspaceTools.constructor.callback@45:47.callback@48:83` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:48:176 | `WorkspaceTools.constructor.callback@45:47.callback@48:176` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:48:259 | `WorkspaceTools.constructor.callback@45:47.callback@48:259` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:51:25 | `WorkspaceTools.constructor.callback@51:25` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:52:38 | `WorkspaceTools.constructor.callback@52:38` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:54:35 | `WorkspaceTools.constructor.callback@52:38.callback@54:35` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:54:84 | `WorkspaceTools.constructor.callback@52:38.callback@54:84` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:56:32 | `WorkspaceTools.constructor.callback@56:32` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:60:41 | `WorkspaceTools.constructor.callback@60:41` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:70:120 | `WorkspaceTools.constructor.callback@70:120` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:71:88 | `WorkspaceTools.constructor.callback@71:88` | UC-01, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 | callback within owning workflow |
| src/workspace-tools.ts:73:3 | `WorkspaceTools.refresh` | UC-26 | application implementation |
| src/workspace-tools.ts:74:3 | `WorkspaceTools.setStatus` | UC-08, UC-09 | application implementation |
| src/workspace-tools.ts:77:3 | `WorkspaceTools.updateSyncButton` | UC-26 | application implementation |
| src/workspace-tools.ts:80:3 | `WorkspaceTools.refreshExportChecks` | UC-31 | application implementation |
| src/workspace-tools.ts:89:3 | `WorkspaceTools.showIssues` | UC-31 | application implementation |
| src/workspace-tools.ts:97:40 | `WorkspaceTools.showIssues.callback@97:40` | UC-31 | callback within owning workflow |
| src/workspace-tools.ts:102:44 | `WorkspaceTools.showIssues.callback@97:40.callback@102:44` | UC-31 | callback within owning workflow |
| src/workspace-tools.ts:113:3 | `WorkspaceTools.showChecks` | UC-31 | application implementation |
| src/workspace-tools.ts:115:37 | `WorkspaceTools.showChecks.callback@115:37` | UC-31 | callback within owning workflow |
| src/workspace-tools.ts:116:38 | `WorkspaceTools.showChecks.callback@116:38` | UC-31 | callback within owning workflow |
| src/workspace-tools.ts:123:3 | `WorkspaceTools.openReferences` | UC-18 | application implementation |
| src/workspace-tools.ts:127:84 | `WorkspaceTools.openReferences.callback@127:84` | UC-18 | callback within owning workflow |
| src/workspace-tools.ts:133:37 | `WorkspaceTools.openReferences.callback@133:37` | UC-18 | callback within owning workflow |
| src/workspace-tools.ts:138:38 | `WorkspaceTools.openReferences.callback@138:38` | UC-18 | callback within owning workflow |

## Verification and build callables

These implement UC-38. Application acceptance is additionally connected through the feature matrix. The JSON lists each callable individually.

| File | Callables | Use case |
| --- | --- | --- |
| [scripts/audit-probes.mjs](../scripts/audit-probes.mjs) | 9 | UC-38 |
| [scripts/check-audit-coverage.mjs](../scripts/check-audit-coverage.mjs) | 21 | UC-38 |
| [scripts/license-notices.mjs](../scripts/license-notices.mjs) | 4 | UC-38 |
| [scripts/update-audit-coverage.mjs](../scripts/update-audit-coverage.mjs) | 19 | UC-38 |
| [tests/authoring.test.ts](../tests/authoring.test.ts) | 19 | UC-38 |
| [tests/browser-print.test.ts](../tests/browser-print.test.ts) | 13 | UC-38 |
| [tests/components.test.ts](../tests/components.test.ts) | 27 | UC-38 |
| [tests/documents.test.ts](../tests/documents.test.ts) | 26 | UC-38 |
| [tests/editor.test.ts](../tests/editor.test.ts) | 20 | UC-38 |
| [tests/katex.test.ts](../tests/katex.test.ts) | 14 | UC-38 |
| [tests/markdown.test.ts](../tests/markdown.test.ts) | 18 | UC-38 |
| [tests/navigation.test.ts](../tests/navigation.test.ts) | 11 | UC-38 |
| [tests/package.test.ts](../tests/package.test.ts) | 8 | UC-38 |
| [tests/pages.e2e.mjs](../tests/pages.e2e.mjs) | 15 | UC-38 |
| [tests/pages.test.ts](../tests/pages.test.ts) | 15 | UC-38 |
| [tests/pagination-flow.test.ts](../tests/pagination-flow.test.ts) | 23 | UC-38 |
| [tests/paginator.test.ts](../tests/paginator.test.ts) | 11 | UC-38 |
| [tests/storage.test.ts](../tests/storage.test.ts) | 5 | UC-38 |
| [tests/workspace.e2e.mjs](../tests/workspace.e2e.mjs) | 36 | UC-38 |
| [vite.config.ts](../vite.config.ts) | 1 | UC-38 |

## Every repository file

This includes audit additions and all non-ignored tracked/untracked project files present at completion. Support files are associated with maintenance, rather than fabricated end-user controls.

| File | Category | Use cases |
| --- | --- | --- |
| [.codex/config.toml](../.codex/config.toml) | repository support | UC-38 |
| [.gitattributes](../.gitattributes) | repository support | UC-38 |
| [.github/copilot-instructions.md](../.github/copilot-instructions.md) | repository support | UC-38 |
| [.github/instructions/frontend.instructions.md](../.github/instructions/frontend.instructions.md) | repository support | UC-38 |
| [.github/prompts/SLASH_COMMANDS.md](../.github/prompts/SLASH_COMMANDS.md) | repository support | UC-38 |
| [.github/prompts/project-audit-implementation.prompt.md](../.github/prompts/project-audit-implementation.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-audit-tests.prompt.md](../.github/prompts/project-audit-tests.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-build-single-html.prompt.md](../.github/prompts/project-build-single-html.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-fix-problems.prompt.md](../.github/prompts/project-fix-problems.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-fix-runtime.prompt.md](../.github/prompts/project-fix-runtime.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-fix-tests.prompt.md](../.github/prompts/project-fix-tests.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-git-initial-commit.prompt.md](../.github/prompts/project-git-initial-commit.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-plan-codex.prompt.md](../.github/prompts/project-plan-codex.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-refresh-docs.prompt.md](../.github/prompts/project-refresh-docs.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-setup-json.prompt.md](../.github/prompts/project-setup-json.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-sync-metadata.prompt.md](../.github/prompts/project-sync-metadata.prompt.md) | repository support | UC-38 |
| [.github/prompts/project-todonow-prd.prompt.md](../.github/prompts/project-todonow-prd.prompt.md) | repository support | UC-38 |
| [.github/workflows/pages.yml](../.github/workflows/pages.yml) | repository support | UC-38 |
| [.gitignore](../.gitignore) | repository support | UC-38 |
| [LICENSE](../LICENSE) | repository support | UC-38 |
| [MANUAL_TESTING.md](../MANUAL_TESTING.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [ProjectPlan.md](../ProjectPlan.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [README.md](../README.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [docs/AUDIT.md](../docs/AUDIT.md) | audit deliverable | UC-38 |
| [docs/CODE_REVIEW.md](../docs/CODE_REVIEW.md) | audit deliverable | UC-38 |
| [docs/FEATURE_COVERAGE.md](../docs/FEATURE_COVERAGE.md) | audit deliverable | UC-38 |
| [docs/FUNCTION_COVERAGE.md](../docs/FUNCTION_COVERAGE.md) | audit deliverable | UC-38 |
| [docs/LIVE_REVIEW.md](../docs/LIVE_REVIEW.md) | audit deliverable | UC-38 |
| [docs/USE_CASES.md](../docs/USE_CASES.md) | audit deliverable | UC-38 |
| [docs/audit/coverage.json](../docs/audit/coverage.json) | audit deliverable | UC-38 |
| [docs/audit/fixture-results.json](../docs/audit/fixture-results.json) | audit deliverable | UC-38 |
| [docs/audit/fixtures/engineering-note.md](../docs/audit/fixtures/engineering-note.md) | audit deliverable | UC-01, UC-06, UC-09, UC-32, UC-37, UC-38 |
| [docs/audit/fixtures/engineering-note.md2pdf.zip](../docs/audit/fixtures/engineering-note.md2pdf.zip) | audit deliverable | UC-01, UC-06, UC-09, UC-32, UC-37, UC-38 |
| [docs/audit/fixtures/method-handout.md](../docs/audit/fixtures/method-handout.md) | audit deliverable | UC-04, UC-06, UC-09, UC-11, UC-24, UC-32, UC-38 |
| [docs/audit/fixtures/method-handout.md2pdf.zip](../docs/audit/fixtures/method-handout.md2pdf.zip) | audit deliverable | UC-04, UC-06, UC-09, UC-11, UC-24, UC-32, UC-38 |
| [docs/audit/fixtures/research-update.md](../docs/audit/fixtures/research-update.md) | audit deliverable | UC-03, UC-06, UC-09, UC-32, UC-36, UC-38 |
| [docs/audit/fixtures/research-update.md2pdf.zip](../docs/audit/fixtures/research-update.md2pdf.zip) | audit deliverable | UC-03, UC-06, UC-09, UC-32, UC-36, UC-38 |
| [docs/audit/live-results.json](../docs/audit/live-results.json) | audit deliverable | UC-38 |
| [docs/audit/live-workspace.jpg](../docs/audit/live-workspace.jpg) | audit deliverable | UC-38 |
| [docs/audit/pdf-results.json](../docs/audit/pdf-results.json) | audit deliverable | UC-38 |
| [docs/audit/probe-results.json](../docs/audit/probe-results.json) | audit deliverable | UC-38 |
| [docs/audit/research-preview.jpg](../docs/audit/research-preview.jpg) | audit deliverable | UC-38 |
| [index.html](../index.html) | user interface | UC-01, UC-10, UC-11, UC-15, UC-16, UC-19, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-26, UC-29, UC-30, UC-31, UC-32, UC-33, UC-34, UC-39 |
| [package-lock.json](../package-lock.json) | repository support | UC-38 |
| [package.json](../package.json) | repository support | UC-38 |
| [project-setup.json](../project-setup.json) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [public/LICENSE.txt](../public/LICENSE.txt) | repository support | UC-38 |
| [public/THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt) | repository support | UC-38 |
| [samples/sample.md](../samples/sample.md) | repository support | UC-02, UC-12, UC-24, UC-38 |
| [scripts/audit-probes.mjs](../scripts/audit-probes.mjs) | repository support | UC-38 |
| [scripts/check-audit-coverage.mjs](../scripts/check-audit-coverage.mjs) | repository support | UC-38 |
| [scripts/license-notices.mjs](../scripts/license-notices.mjs) | repository support | UC-38 |
| [scripts/licenses/katex-fonts-LICENSE.txt](../scripts/licenses/katex-fonts-LICENSE.txt) | repository support | UC-38 |
| [scripts/licenses/pako-zlib-NOTICE.txt](../scripts/licenses/pako-zlib-NOTICE.txt) | repository support | UC-38 |
| [scripts/update-audit-coverage.mjs](../scripts/update-audit-coverage.mjs) | repository support | UC-38 |
| [src/authoring.ts](../src/authoring.ts) | runtime | UC-10, UC-11, UC-12, UC-13, UC-14, UC-28, UC-30 |
| [src/browser-print.ts](../src/browser-print.ts) | runtime | UC-31, UC-32, UC-33, UC-34, UC-39 |
| [src/dialog.ts](../src/dialog.ts) | runtime | UC-06, UC-07, UC-09, UC-14, UC-15, UC-16, UC-19, UC-30, UC-31 |
| [src/document.ts](../src/document.ts) | runtime | UC-02, UC-06, UC-08, UC-09, UC-14, UC-15, UC-16, UC-18, UC-19, UC-20, UC-32, UC-35 |
| [src/editor.ts](../src/editor.ts) | runtime | UC-01, UC-02, UC-05, UC-07, UC-08, UC-10, UC-11, UC-14, UC-15, UC-16, UC-24, UC-26, UC-27, UC-28, UC-30, UC-38, UC-39 |
| [src/katex.ts](../src/katex.ts) | runtime | UC-11, UC-12, UC-14, UC-35, UC-39 |
| [src/layout-tools.ts](../src/layout-tools.ts) | runtime | UC-19, UC-20, UC-21, UC-22, UC-23 |
| [src/main.ts](../src/main.ts) | runtime | UC-01, UC-02, UC-05, UC-06, UC-07, UC-08, UC-09, UC-13, UC-16, UC-17, UC-19, UC-20, UC-24, UC-26, UC-31, UC-32, UC-33, UC-34, UC-35, UC-39 |
| [src/markdown.ts](../src/markdown.ts) | runtime | UC-10, UC-11, UC-12, UC-14, UC-18, UC-21, UC-22, UC-24, UC-35, UC-36 |
| [src/media-tools.ts](../src/media-tools.ts) | runtime | UC-15, UC-16, UC-17, UC-30 |
| [src/navigation.ts](../src/navigation.ts) | runtime | UC-14, UC-15, UC-16, UC-22, UC-26, UC-27, UC-29, UC-30 |
| [src/package.ts](../src/package.ts) | runtime | UC-09 |
| [src/pages.ts](../src/pages.ts) | runtime | UC-05, UC-12, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-39 |
| [src/paginator.ts](../src/paginator.ts) | runtime | UC-11, UC-15, UC-16, UC-20, UC-24, UC-26 |
| [src/preflight.ts](../src/preflight.ts) | runtime | UC-14, UC-17, UC-18, UC-23, UC-24, UC-31, UC-32 |
| [src/storage.ts](../src/storage.ts) | runtime | UC-08 |
| [src/ui.ts](../src/ui.ts) | runtime | UC-01, UC-02, UC-05, UC-06, UC-07, UC-08, UC-20, UC-25, UC-29, UC-30, UC-32, UC-33, UC-34, UC-39 |
| [src/visual-math.ts](../src/visual-math.ts) | runtime | UC-13, UC-14, UC-30 |
| [src/vite-env.d.ts](../src/vite-env.d.ts) | runtime | UC-38 |
| [src/workspace-tools.ts](../src/workspace-tools.ts) | runtime | UC-01, UC-08, UC-09, UC-15, UC-16, UC-18, UC-19, UC-24, UC-26, UC-27, UC-29, UC-31 |
| [style.css](../style.css) | user interface | UC-01, UC-10, UC-11, UC-15, UC-16, UC-19, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-26, UC-29, UC-30, UC-31, UC-32, UC-33, UC-34, UC-39 |
| [temp.md](../temp.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [tests/authoring.test.ts](../tests/authoring.test.ts) | verification | UC-38 |
| [tests/browser-print.test.ts](../tests/browser-print.test.ts) | verification | UC-38 |
| [tests/components.test.ts](../tests/components.test.ts) | verification | UC-38 |
| [tests/documents.test.ts](../tests/documents.test.ts) | verification | UC-38 |
| [tests/editor.test.ts](../tests/editor.test.ts) | verification | UC-38 |
| [tests/katex.test.ts](../tests/katex.test.ts) | verification | UC-38 |
| [tests/markdown.test.ts](../tests/markdown.test.ts) | verification | UC-38 |
| [tests/navigation.test.ts](../tests/navigation.test.ts) | verification | UC-38 |
| [tests/package.test.ts](../tests/package.test.ts) | verification | UC-38 |
| [tests/pages.e2e.mjs](../tests/pages.e2e.mjs) | verification | UC-38 |
| [tests/pages.test.ts](../tests/pages.test.ts) | verification | UC-38 |
| [tests/pagination-flow.test.ts](../tests/pagination-flow.test.ts) | verification | UC-38 |
| [tests/paginator.test.ts](../tests/paginator.test.ts) | verification | UC-38 |
| [tests/storage.test.ts](../tests/storage.test.ts) | verification | UC-38 |
| [tests/workspace.e2e.mjs](../tests/workspace.e2e.mjs) | verification | UC-38 |
| [todo.md](../todo.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [todonowPRD.md](../todonowPRD.md) | repository support | UC-02, UC-32, UC-38, UC-39 |
| [tsconfig.json](../tsconfig.json) | repository support | UC-38 |
| [tsconfig.node.json](../tsconfig.node.json) | repository support | UC-38 |
| [vite.config.ts](../vite.config.ts) | repository support | UC-38 |
| [vitest.config.ts](../vitest.config.ts) | repository support | UC-38 |

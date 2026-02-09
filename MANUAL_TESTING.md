# MD2PDF Manual Testing Guide

This guide verifies the shipped application behavior against the current repository state.

## 1. Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright Chromium (for export testing):
   ```bash
   npx playwright install chromium
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## 2. Core UI and Editing

### TS-01: App shell and defaults

1. Load the app.
2. Confirm split layout: editor pane left, preview pane right.
3. Confirm dark app theme by default.
4. Confirm preview page itself is white.
5. Confirm default font size is `12px` and default margin is `Medium (20mm)`.

Expected:
- Layout loads without console errors.
- Theme affects app chrome only, not page content background.

### TS-02: Markdown live rendering

1. Type heading, paragraph, list, table, and fenced code block content.
2. Confirm preview updates while typing.
3. Confirm content paginates into page-sized sheets.

Expected:
- Render updates are immediate and stable.
- Tables/code blocks are not split awkwardly across pages.

### TS-03: Math rendering

1. Enter inline math: `$E = mc^2$`.
2. Enter display math with matrix:
   ```text
   $$
   \begin{bmatrix}
   1 & 2 \\
   3 & 4
   \end{bmatrix}
   $$
   ```
3. Toggle math mode button.

Expected:
- Math renders correctly.
- Matrix row breaks are preserved.
- Mode toggle re-renders preview without errors.

## 3. Source Sync and Navigation

### TS-04: Editor to preview sync

1. Click several lines in the editor.
2. Observe preview auto-scroll and highlight behavior.

Expected:
- Preview focuses the corresponding rendered block.
- Target highlight is obvious and then fades.

### TS-05: Preview to editor sync

1. Click different rendered blocks in preview.
2. Observe editor selection, scroll position, and highlight.

Expected:
- Editor jumps to the mapped source line.
- Caret/selection and visual pulse make the focus location clear.

## 4. Multi-file Workflow

### TS-06: Upload, list, rename, close

1. Upload one file, then upload multiple files.
2. Confirm file list shows filename (left) and page count (right).
3. Switch active file from the sidebar.
4. Rename a file from the list actions.
5. Close a non-active file, then close the active file.

Expected:
- Multi-file loading works in one action.
- Active file switches correctly.
- Rename affects in-app/export name only.
- Closing files updates active state and preview safely.

### TS-07: Empty-start behavior

1. Start with no uploaded files and blank editor.
2. Confirm no forced untitled document exists.
3. Type content.

Expected:
- Untitled document appears only after user content exists.

## 5. Preview Controls and Layout

### TS-08: Zoom and fit modes

1. Use `Fit Width`, `Fit Page`, `+`, and `-`.
2. Verify zoom percentage readout changes correctly.
3. In default fit-width, confirm page is centered with visible side spacing.

Expected:
- No horizontal scrollbars at default fit-width.
- Horizontal scroll appears only when manual zoom exceeds fit-width.

### TS-09: Pane divider

1. Drag divider left/right.
2. Verify limits at approximately 20% and 80%.
3. Verify keyboard resizing with `ArrowLeft`, `ArrowRight`, `Home`, `End`.

Expected:
- Divider movement is smooth and bounded.
- Preview recalculates correctly after resize.

## 6. Export Flow

### TS-10: Export modal behavior

1. Click `Export PDF`.
2. Confirm modal opens with scope options:
   - current file
   - all open files
3. Start export and observe progress panel and log.
4. Confirm modal height is stable while logs grow.

Expected:
- `n / m` tracks completed files, not started files.
- Status text describes current step accurately.
- Log area scrolls internally; modal does not grow.

### TS-11: Current file export

1. Choose `Current file`.
2. Start export.

Expected:
- PDF downloads automatically (no print dialog).
- Filename is derived from selected markdown filename.
- Progress and completion notifications are accurate.

### TS-12: All files export

1. Open at least two markdown files.
2. Choose `All open files`.
3. Start export.

Expected:
- ZIP downloads automatically.
- ZIP contains one PDF per open file.
- Names follow current in-app markdown filenames.

### TS-13: Export cancel

1. Start a multi-file export.
2. Click `Cancel`.

Expected:
- UI reports cancel requested.
- Current in-flight file can finish, then job stops.
- Final state is `canceled` with clear summary.

## 7. Regression Checks

1. `npm run typecheck`
2. `npm test -- --run`
3. `npm run build`

Expected:
- All checks pass.

## 8. Execution Log Template

| Date | Tester | Browser | TS-01 | TS-02 | TS-03 | TS-04 | TS-05 | TS-06 | TS-07 | TS-08 | TS-09 | TS-10 | TS-11 | TS-12 | TS-13 | Notes |
|------|--------|---------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
|      |        |         |       |       |       |       |       |       |       |       |       |       |       |       |       |       |

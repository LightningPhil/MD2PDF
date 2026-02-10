# MD2PDF Manual Testing Guide

This guide verifies the shipped application behavior against the current repository state.

## 1. Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173`.

## 2. Core UI and Editing

### TS-01: App shell and defaults

1. Load the app.
2. Confirm split layout: editor pane left, canvas preview pane right.
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

Expected:
- Math renders correctly in the canvas preview.
- Matrix row breaks are preserved.

## 3. Multi-file Workflow

### TS-04: Upload, list, rename, close

1. Upload one file, then upload multiple files.
2. Confirm file list shows filename and page count.
3. Switch active file from the sidebar.
4. Rename a file from the list actions.
5. Close a non-active file, then close the active file.

Expected:
- Multi-file loading works in one action.
- Active file switches correctly.
- Rename affects in-app/export name only.
- Closing files updates active state and preview safely.

### TS-05: Empty-start behavior

1. Start with no uploaded files and blank editor.
2. Confirm no forced untitled document exists.
3. Type content.

Expected:
- Untitled document appears only after user content exists.

## 4. Preview Controls and Layout

### TS-06: Zoom and fit modes

1. Use `Fit Width`, `Fit Page`, `+`, and `-`.
2. Verify zoom percentage readout changes correctly.
3. In default fit-width, confirm page is centered with visible side spacing.

Expected:
- No horizontal scrollbars at default fit-width.
- Horizontal scroll appears only when manual zoom exceeds fit-width.

### TS-07: Pane divider

1. Drag divider left/right.
2. Verify limits at approximately 20% and 80%.
3. Verify keyboard resizing with `ArrowLeft`, `ArrowRight`, `Home`, `End`.

Expected:
- Divider movement is smooth and bounded.
- Preview recalculates correctly after resize.

## 5. Export Flow

### TS-08: PDF export

1. Click `Export PDF`.
2. Wait for PDF generation.

Expected:
- PDF downloads automatically (no print dialog).
- Filename is derived from the markdown filename.
- PDF renders identically to canvas preview.

## 6. Regression Checks

1. `npm run typecheck`
2. `npm test`
3. `npm run build`

Expected:
- All checks pass.

## 7. Execution Log Template

| Date | Tester | Browser | TS-01 | TS-02 | TS-03 | TS-04 | TS-05 | TS-06 | TS-07 | TS-08 | Notes |
|------|--------|---------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
|      |        |         |       |       |       |       |       |       |       |       |       |

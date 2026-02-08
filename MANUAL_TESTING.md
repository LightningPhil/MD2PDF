# MD2PDF Manual Testing Guide

This document provides comprehensive manual testing procedures for the MD2PDF application to verify all Phase 1 requirements from ProjectPlan.md.

## Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open http://localhost:3000 in a browser

## Test Scenarios

### TS-01: Basic Editor Functionality (REQ-01, REQ-03)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load the application | Split-pane UI appears with editor (left) and preview (right) |
| 2 | Type "# Hello World" in editor | Text appears in editor area |
| 3 | Wait 1 second | Preview updates automatically showing "Hello World" as heading |
| 4 | Type additional text | Preview updates live as you type |
| 5 | Select text and use Tab key | Text is indented with spaces |

**Pass Criteria**: All steps complete without errors, live preview updates within 1 second.

---

### TS-02: Markdown Rendering (REQ-10)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter `# Heading 1` | H1 heading rendered |
| 2 | Enter `## Heading 2` | H2 heading rendered |
| 3 | Enter `**bold**` | Bold text rendered |
| 4 | Enter `*italic*` | Italic text rendered |
| 5 | Enter `- item` on multiple lines | Unordered list rendered |
| 6 | Enter `1. item` on multiple lines | Ordered list rendered |
| 7 | Enter `` `inline code` `` | Inline code styled |
| 8 | Enter triple backtick code block | Code block with syntax highlighting |
| 9 | Enter `[link](https://example.com)` | Clickable link rendered |
| 10 | Enter `> quote text` | Blockquote styled |
| 11 | Enter `---` | Horizontal rule rendered |
| 12 | Enter table markdown | Table with borders rendered |

**Pass Criteria**: All markdown elements render correctly in preview.

---

### TS-03: KaTeX Math Rendering (REQ-04)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter `$E = mc^2$` | Inline equation rendered with proper math formatting |
| 2 | Enter `$$\int_0^1 x dx$$` | Display equation rendered centered, larger |
| 3 | Enter `$\frac{a}{b}$` | Fraction renders correctly |
| 4 | Enter `$\sqrt{x}$` | Square root renders correctly |
| 5 | Enter `$\sum_{i=1}^{n} i$` | Summation renders correctly |
| 6 | Enter matrix: `$$\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$$` | Matrix renders correctly |

**Pass Criteria**: All math expressions render without errors, using proper mathematical typography.

---

### TS-04: Math Mode Toggle (REQ-05)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter `$E = mc^2$` | Equation renders in HTML mode (default) |
| 2 | Click "🧮 Math: HTML" button | Button changes to "🧮 Math: SVG" |
| 3 | Observe equation | Equation re-renders in SVG format |
| 4 | Click button again | Button changes back to "🧮 Math: HTML" |
| 5 | Observe equation | Equation renders in HTML format again |

**Pass Criteria**: Toggle works, equation visually changes between modes.

---

### TS-05: A4 Page Styling (REQ-02, REQ-09)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe preview pane | Pages appear with A4 proportions |
| 2 | Check page styling | White background, drop shadow visible |
| 3 | Check margins | Content has visible margins (not edge-to-edge) |
| 4 | Check stacking | Multiple pages stack vertically with gaps |
| 5 | Check page numbers | Page numbers appear at bottom of each page |

**Pass Criteria**: Pages look like printed A4 document sheets.

---

### TS-06: Smart Pagination (REQ-08)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter 20+ paragraphs of text | Content flows across multiple pages |
| 2 | Enter `## Heading` followed by paragraph | Heading stays with following paragraph |
| 3 | Enter large table (10+ rows) | Table moves intact to next page OR stays on current (not split) |
| 4 | Enter `$$` display math equation | Equation not split across pages |
| 5 | Enter large code block | Code block stays atomic if possible |

**Pass Criteria**: No mid-equation, mid-table, or awkward heading orphans.

---

### TS-07: File Upload (REQ-06)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "📁 Upload" button | File picker dialog opens |
| 2 | Select a .md file | File loads into editor |
| 3 | Observe notification | "Loaded [filename]" toast appears |
| 4 | Check preview | Content from file renders in preview |
| 5 | Drag and drop .md file onto app | File loads (alternative method) |

**Pass Criteria**: Files load correctly, editor and preview update.

---

### TS-08: File Save (REQ-07)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter some markdown content | Content appears in editor |
| 2 | Click "💾 Save" button | Browser download dialog appears |
| 3 | Save the file | File named "document.md" downloads |
| 4 | Open downloaded file | Contains exact content from editor |
| 5 | Check notification | "Saved document.md" toast appears |

**Pass Criteria**: Downloaded file contains correct markdown content.

---

### TS-09: Error Handling

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter invalid LaTeX: `$\invalid{$` | Error handled gracefully, original text shown |
| 2 | Upload non-text file | Error message appears (or graceful handling) |
| 3 | No console errors during normal use | DevTools console is clean |

**Pass Criteria**: No uncaught exceptions, user-friendly error handling.

---

### TS-10: Performance (Large Document)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load samples/sample.md | File loads within 2 seconds |
| 2 | Type in editor | Response feels immediate (<500ms) |
| 3 | Scroll through pages | Smooth scrolling, no lag |
| 4 | Toggle math mode | Switch happens within 1 second |

**Pass Criteria**: Application remains responsive with typical documents.

---

## Sample Test Content

Use this content to exercise multiple features:

```markdown
# Mathematics Showcase

Inline math: $E = mc^2$

Display math:
$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

## Table

| Feature | Status |
|---------|--------|
| Editor | ✓ |
| Preview | ✓ |

## Code

```javascript
console.log("Hello, world!");
```

## List
- Item one
- Item two
  - Nested item
```

---

## Definition of Done Checklist (from ProjectPlan.md Section 12)

- [ ] Markdown edits live-update preview
- [ ] Pages look like A4 sheets
- [ ] Equations render correctly
- [ ] No accidental half-equation page breaks
- [ ] Tables move intact
- [ ] User can upload and save Markdown
- [ ] SVG/HTML KaTeX modes can be toggled

---

## Test Execution Log

| Date | Tester | Browser | TS-01 | TS-02 | TS-03 | TS-04 | TS-05 | TS-06 | TS-07 | TS-08 | TS-09 | TS-10 | Notes |
|------|--------|---------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| | | | | | | | | | | | | | |

---

## Reporting Issues

If a test fails, document:
1. Test scenario ID (e.g., TS-03)
2. Step number where failure occurred
3. Expected vs actual behavior
4. Browser and version
5. Console errors (if any)
6. Screenshot (if applicable)
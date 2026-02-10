/**
 * Core document layout engine.
 *
 * Purpose:
 * - Convert parsed markdown blocks into a page-level display list (`DrawOp[]`).
 * - Apply deterministic line breaking, pagination, tables, code blocks, and math placement.
 *
 * Usage:
 * - Called by `typesetter.typeset()` after option normalization and font registration.
 * - Output is consumed unchanged by both Canvas and PDF renderers.
 */
import { FontMetricsProvider } from "../font-metrics";
import {
  parseMarkdownBlocks,
  type MarkdownBlock,
  type TableAlign
} from "../markdown";
import { layoutMathExpression, type MathBox } from "../math/layout";
import type {
  DrawOp,
  GlyphOp,
  GlyphRunOp,
  NormalizedTypesetOptions,
  PageLayout,
  SourceMappingEntry,
  TextSpanOp,
  TypesetDiagnostics,
  TypesetResult
} from "../types";
import { parseInlineNodes, type InlineTextStyle } from "./inline-parser";

type SpanRole = TextSpanOp["role"];

type TextFragment = {
  kind: "text";
  text: string;
  fontId: string;
  fontSizePt: number;
  width: number;
  ascent: number;
  descent: number;
  isSpace: boolean;
  allowCharBreak: boolean;
  charWidths: number[];
  bold: boolean;
  italic: boolean;
  strike: boolean;
  linkHref?: string;
  sourceKind: "markdown" | "math";
};

type MathFragment = {
  kind: "math";
  width: number;
  ascent: number;
  descent: number;
  isSpace: false;
  allowCharBreak: false;
  box: MathBox;
  sourceKind: "math";
};

type BreakFragment = {
  kind: "break";
  width: 0;
  ascent: 0;
  descent: 0;
  isSpace: false;
  allowCharBreak: false;
  sourceKind: "markdown";
};

type InlineFragment = TextFragment | MathFragment | BreakFragment;

type LayoutState = {
  pages: PageLayout[];
  currentPage: PageLayout;
  cursorYPt: number;
  diagnostics: TypesetDiagnostics;
  options: NormalizedTypesetOptions;
  metrics: FontMetricsProvider;
  mathCache: Map<string, MathBox>;
  spanCounter: number;
};

type ParagraphStyle = {
  fontId: string;
  codeFontId: string;
  fontSizePt: number;
  lineHeightMult: number;
  afterPt: number;
  firstLineIndentPt: number;
  hangingIndentPt: number;
  parseInline: boolean;
  role: SpanRole;
};

type CodeVisualLine = {
  text: string;
  lineNumber: number | null;
};

type TableRowLayout = {
  cells: TableCellLayout[];
  heightPt: number;
};

type TableCellLayout = {
  lines: TableLineLayout[];
  contentHeightPt: number;
};

type TableLineLayout = {
  fragments: InlineFragment[];
  widthPt: number;
  ascentPt: number;
  descentPt: number;
  heightPt: number;
};

export function layoutDocument(
  markdown: string,
  options: NormalizedTypesetOptions,
  metrics: FontMetricsProvider
): TypesetResult {
  const timingsStart = performanceNow();
  const diagnostics: TypesetDiagnostics = { warnings: [], errors: [], timingsMs: {} };

  const parseStart = performanceNow();
  // Parse stage is measured separately so regressions are easy to isolate.
  const blocks = parseMarkdownBlocks(markdown);
  diagnostics.timingsMs!.parseMarkdown = performanceNow() - parseStart;

  const state = createInitialState(options, diagnostics, metrics);
  const sourceMapping: SourceMappingEntry[] = [];

  const layoutStart = performanceNow();
  // Layout stage owns all geometry decisions; renderers should be paint-only.
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const next = blocks[i + 1] ?? null;
    
    // Capture position before block layout
    const startPageIndex = state.currentPage.index;
    const startYPt = state.cursorYPt;
    
    layoutBlock(block, next, state);
    
    // Capture position after block layout
    const endPageIndex = state.currentPage.index;
    const endYPt = state.cursorYPt;
    
    // Add source mapping entry
    if (block.sourceLines) {
      sourceMapping.push({
        sourceLineStart: block.sourceLines.start,
        sourceLineEnd: block.sourceLines.end,
        pageIndex: startPageIndex,
        yStartPt: startYPt,
        yEndPt: endPageIndex === startPageIndex ? endYPt : state.options.page.resolved.heightPt
      });
    }
  }
  diagnostics.timingsMs!.layout = performanceNow() - layoutStart;

  // Add headers and footers to each page
  const hfStart = performanceNow();
  addHeadersAndFooters(state.pages, options, metrics);
  diagnostics.timingsMs!.headerFooter = performanceNow() - hfStart;

  diagnostics.timingsMs!.total = performanceNow() - timingsStart;

  return {
    pages: state.pages,
    diagnostics,
    sourceMapping
  };
}

function layoutBlock(
  block: MarkdownBlock,
  next: MarkdownBlock | null,
  state: LayoutState
): void {
  const { typography } = state.options;
  const textFontId = state.options.fonts.text.id;
  const monoFontId = state.options.fonts.mono?.id ?? textFontId;

  switch (block.kind) {
    case "heading": {
      const scale =
        block.level === 1
          ? typography.headingScale.h1
          : block.level === 2
            ? typography.headingScale.h2
            : typography.headingScale.h3;

      const headingFontSize = typography.baseFontSizePt * scale;
      const beforePt = headingFontSize * 0.35;
      const afterPt = headingFontSize * 0.2;

      state.cursorYPt += beforePt;
      ensureKeepWithNext(headingFontSize, next, state);

      layoutParagraph(
        block.text,
        {
          fontId: textFontId,
          codeFontId: monoFontId,
          fontSizePt: headingFontSize,
          lineHeightMult: 1.15,
          afterPt,
          firstLineIndentPt: 0,
          hangingIndentPt: 0,
          parseInline: true,
          role: "heading"
        },
        state
      );
      break;
    }
    case "paragraph": {
      layoutParagraph(
        block.text,
        {
          fontId: textFontId,
          codeFontId: monoFontId,
          fontSizePt: typography.baseFontSizePt,
          lineHeightMult: typography.lineHeight,
          afterPt: typography.paragraphSpacingPt,
          firstLineIndentPt: 0,
          hangingIndentPt: 0,
          parseInline: true,
          role: "paragraph"
        },
        state
      );
      break;
    }
    case "list": {
      layoutList(block, state);
      state.cursorYPt += typography.paragraphSpacingPt * 0.25;
      break;
    }
    case "blockquote": {
      layoutBlockquote(block.depth, block.text, state);
      break;
    }
    case "code": {
      state.cursorYPt += typography.paragraphSpacingPt * 0.35;
      layoutCodeBlock(block.lines, monoFontId, state);
      state.cursorYPt += typography.paragraphSpacingPt * 0.65;
      break;
    }
    case "displayMath": {
      layoutDisplayMath(block.expr, state);
      break;
    }
    case "table": {
      if (!state.options.features.tables) {
        layoutParagraph(
          block.header.join(" | "),
          {
            fontId: textFontId,
            codeFontId: monoFontId,
            fontSizePt: typography.baseFontSizePt,
            lineHeightMult: typography.lineHeight,
            afterPt: typography.paragraphSpacingPt,
            firstLineIndentPt: 0,
            hangingIndentPt: 0,
            parseInline: false,
            role: "paragraph"
          },
          state
        );
        break;
      }
      layoutTableBlock(block, state);
      break;
    }
    case "hr": {
      const gap = typography.paragraphSpacingPt * 1.25;
      state.cursorYPt += gap;
      ensureVerticalSpace(1, state);
      state.currentPage.ops.push({
        kind: "rule",
        xPt: state.options.page.resolved.contentXPt,
        yPt: state.cursorYPt,
        wPt: state.options.page.resolved.contentWPt,
        hPt: 1
      });
      state.cursorYPt += gap;
      break;
    }
    default:
      break;
  }
}

function layoutParagraph(text: string, style: ParagraphStyle, state: LayoutState): void {
  const fragments = style.parseInline
    ? parseParagraphFragments(text, style, state)
    : [
        createTextFragment(
          text,
          style.fontId,
          style.fontSizePt,
          state.metrics,
          false,
          true
        )
      ];

  layoutFragmentsIntoLines(fragments, style, state);
}

function parseParagraphFragments(
  text: string,
  style: ParagraphStyle,
  state: LayoutState
): InlineFragment[] {
  const nodes = parseInlineNodes(text);
  const fragments: InlineFragment[] = [];

  for (const node of nodes) {
    if (node.kind === "lineBreak") {
      fragments.push({
        kind: "break",
        width: 0,
        ascent: 0,
        descent: 0,
        isSpace: false,
        allowCharBreak: false,
        sourceKind: "markdown"
      });
      continue;
    }

    if (node.kind === "text") {
      const resolvedFontId = resolveStyledFontId(node.style, style.fontId, state);
      fragments.push(
        ...createTextFragmentsFromText(
          node.text,
          resolvedFontId,
          style.fontSizePt,
          state.metrics,
          node.style
        )
      );
      continue;
    }

    if (node.kind === "code") {
      const codeStyle = node.style;
      fragments.push(
        createTextFragment(
          node.code,
          style.codeFontId,
          style.fontSizePt * 0.94,
          state.metrics,
          false,
          true,
          {
            bold: codeStyle?.bold ?? false,
            italic: codeStyle?.italic ?? false,
            strike: codeStyle?.strike ?? false,
            linkHref: codeStyle?.href
          }
        )
      );
      continue;
    }

    try {
      const box = getMathBox(node.expr, style.fontSizePt, false, state);
      fragments.push({
        kind: "math",
        width: box.w,
        ascent: box.a,
        descent: box.d,
        isSpace: false,
        allowCharBreak: false,
        box,
        sourceKind: "math"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.diagnostics.errors.push(
        `Math parse/layout failed for "${node.expr}": ${message}`
      );
      fragments.push(
        createTextFragment(
          formatMathErrorText(message),
          style.fontId,
          style.fontSizePt,
          state.metrics,
          false,
          true
        )
      );
    }
  }

  return fragments;
}

function layoutFragmentsIntoLines(
  sourceFragments: InlineFragment[],
  style: ParagraphStyle,
  state: LayoutState
): void {
  const fragments = sourceFragments.slice();
  const resolved = state.options.page.resolved;
  const baseAscent = state.metrics.getAscent(style.fontId, style.fontSizePt);
  const baseDescent = state.metrics.getDescent(style.fontId, style.fontSizePt);
  const paragraphStartYPt = state.cursorYPt;

  let lineIndex = 0;
  let idx = 0;

  while (idx < fragments.length) {
    const indentPt = lineIndex === 0 ? style.firstLineIndentPt : style.hangingIndentPt;
    const maxWidthPt = Math.max(1, resolved.contentWPt - indentPt);

    const lineFragments: InlineFragment[] = [];
    let lineWidthPt = 0;
    let forcedBreak = false;

    while (idx < fragments.length) {
      let fragment = fragments[idx];

      if (fragment.kind === "break") {
        idx += 1;
        forcedBreak = true;
        break;
      }

      if (fragment.isSpace && lineFragments.length === 0) {
        idx += 1;
        continue;
      }

      if (
        lineFragments.length === 0 &&
        fragment.kind === "text" &&
        fragment.allowCharBreak &&
        fragment.width > maxWidthPt
      ) {
        // If a single token exceeds width, split early to avoid infinite wrapping loops.
        const split = splitTextFragmentToWidth(fragment, maxWidthPt, style, state);
        if (split.head) {
          fragment = split.head;
          lineFragments.push(fragment);
          lineWidthPt += fragment.width;
          if (split.tail) {
            fragments[idx] = split.tail;
          } else {
            idx += 1;
          }
          break;
        }
      }

      if (lineWidthPt + fragment.width <= maxWidthPt || lineFragments.length === 0) {
        lineFragments.push(fragment);
        lineWidthPt += fragment.width;
        idx += 1;
        continue;
      }

      break;
    }

    trimTrailingSpaces(lineFragments);
    if (lineFragments.length === 0) {
      continue;
    }

    if (
      state.options.features.typography.justification &&
      !forcedBreak &&
      idx < fragments.length &&
      lineWidthPt / maxWidthPt >= state.options.features.typography.justifyMinLineFill
    ) {
      const extra = Math.max(0, maxWidthPt - lineWidthPt);
      if (extra > 0.01) {
        lineWidthPt += applyJustificationSpacing(lineFragments, extra);
      }
    }

    const lineAscent = Math.max(baseAscent, ...lineFragments.map((fragment) => fragment.ascent));
    const lineDescent = Math.max(baseDescent, ...lineFragments.map((fragment) => fragment.descent));
    const naturalHeight = lineAscent + lineDescent;
    const defaultLineHeight = style.fontSizePt * style.lineHeightMult;
    const lineHeightPt = Math.max(defaultLineHeight, naturalHeight + 1);

    if (
      state.options.features.typography.widowOrphanControl &&
      lineIndex === 0 &&
      state.cursorYPt > paragraphStartYPt &&
      resolved.contentBottomPt - state.cursorYPt < lineHeightPt * 1.2
    ) {
      addPage(state);
    }

    ensureVerticalSpace(lineHeightPt, state);

    const extraLead = Math.max(0, lineHeightPt - naturalHeight);
    const baselinePt = state.cursorYPt + extraLead / 2 + lineAscent;
    let xPt = resolved.contentXPt + indentPt;

    for (const fragment of lineFragments) {
      emitFragment(fragment, xPt, baselinePt, state.currentPage.ops, state.metrics, state, style.role);
      xPt += fragment.width;
    }

    state.cursorYPt += lineHeightPt;
    lineIndex += 1;
  }

  state.cursorYPt += style.afterPt;
}

function layoutList(block: Extract<MarkdownBlock, { kind: "list" }>, state: LayoutState): void {
  const { typography } = state.options;
  const fontId = state.options.fonts.text.id;
  const codeFontId = state.options.fonts.mono?.id ?? fontId;
  const fontSizePt = typography.baseFontSizePt;
  const indentStep = fontSizePt * 1.6;
  const orderedCounters = new Map<number, number>();

  for (let i = 0; i < block.items.length; i += 1) {
    const depth = Math.max(0, Math.min(1, block.itemDepths?.[i] ?? 0));
    const itemKind = block.itemKinds?.[i] ?? (block.ordered ? "ordered" : "unordered");

    for (const key of Array.from(orderedCounters.keys())) {
      if (key > depth) {
        orderedCounters.delete(key);
      }
    }

    let marker = depth === 0 ? "-" : "*";
    if (itemKind === "ordered") {
      const explicit = block.itemNumbers?.[i];
      const next = explicit ?? ((orderedCounters.get(depth) ?? 0) + 1);
      orderedCounters.set(depth, next);
      marker = `${next}.`;
    }

    const markerWidth = state.metrics.getTextWidth(fontId, `${marker} `, fontSizePt);
    const firstIndent = depth * indentStep;
    const hangingIndent = firstIndent + Math.max(indentStep * 0.9, markerWidth);
    const fullText = `${marker} ${block.items[i]}`;

    layoutParagraph(
      fullText,
      {
        fontId,
        codeFontId,
        fontSizePt,
        lineHeightMult: typography.lineHeight,
        afterPt: typography.paragraphSpacingPt * 0.4,
        firstLineIndentPt: firstIndent,
        hangingIndentPt: hangingIndent,
        parseInline: true,
        role: "listItem"
      },
      state
    );
  }
}

function layoutBlockquote(depth: number, text: string, state: LayoutState): void {
  const normalizedDepth = Math.max(1, Math.min(2, depth));
  const fontId = state.options.fonts.text.id;
  const codeFontId = state.options.fonts.mono?.id ?? fontId;
  const fontSizePt = state.options.typography.baseFontSizePt;
  const indent = fontSizePt * 1.2 * normalizedDepth;
  const barX = state.options.page.resolved.contentXPt + indent * 0.35;
  const barWidth = Math.max(1, fontSizePt * 0.08);
  const beforePt = state.options.typography.paragraphSpacingPt * 0.25;
  const afterPt = state.options.typography.paragraphSpacingPt * 0.55;

  state.cursorYPt += beforePt;
  const startPage = state.currentPage.index;
  const startY = state.cursorYPt;

  layoutParagraph(
    text,
    {
      fontId,
      codeFontId,
      fontSizePt,
      lineHeightMult: state.options.typography.lineHeight,
      afterPt,
      firstLineIndentPt: indent,
      hangingIndentPt: indent,
      parseInline: true,
      role: "paragraph"
    },
    state
  );

  if (state.currentPage.index === startPage) {
    const endY = Math.max(startY + 1, state.cursorYPt - afterPt);
    state.currentPage.ops.push({
      kind: "rule",
      xPt: barX,
      yPt: startY,
      wPt: barWidth,
      hPt: endY - startY,
      colorRgb: [0.35, 0.35, 0.35]
    });
  }
}

function layoutCodeBlock(lines: string[], fontId: string, state: LayoutState): void {
  const codeOptions = state.options.features.codeBlocks;
  const resolved = state.options.page.resolved;
  const baseSize = state.options.typography.baseFontSizePt * 0.9;
  const lineHeightPt = Math.max(
    baseSize * 1.28,
    state.metrics.getAscent(fontId, baseSize) + state.metrics.getDescent(fontId, baseSize) + 1
  );

  const tabSize = Math.max(1, codeOptions.tabSize);
  const normalizedLines = (lines.length === 0 ? [""] : lines).map((line) =>
    expandTabs(line, tabSize)
  );

  const lineNumberFontSize = baseSize * 0.86;
  const lineNumberDigits = Math.max(1, String(normalizedLines.length).length);
  const gutterWidthPt = codeOptions.lineNumbers
    ? state.metrics.getTextWidth(fontId, "9".repeat(lineNumberDigits), lineNumberFontSize) +
      baseSize * 0.65
    : 0;

  const paddingPt = codeOptions.background ? codeOptions.paddingPt : 0;
  const textMaxWidth = Math.max(1, resolved.contentWPt - paddingPt * 2 - gutterWidthPt);

  const visualLines: CodeVisualLine[] = [];
  for (let lineIndex = 0; lineIndex < normalizedLines.length; lineIndex += 1) {
    const normalized = normalizedLines[lineIndex];

    const segments = codeOptions.wrapLongLines
      ? wrapLineByCharacters(normalized, fontId, baseSize, state.metrics, textMaxWidth)
      : [normalized];

    if (segments.length === 0) {
      visualLines.push({
        text: "",
        lineNumber: codeOptions.lineNumbers ? lineIndex + 1 : null
      });
      continue;
    }

    for (let i = 0; i < segments.length; i += 1) {
      visualLines.push({
        text: segments[i],
        lineNumber: codeOptions.lineNumbers && i === 0 ? lineIndex + 1 : null
      });
    }
  }

  if (visualLines.length === 0) {
    visualLines.push({ text: "", lineNumber: null });
  }

  const ascent = state.metrics.getAscent(fontId, baseSize);
  let cursor = 0;

  while (cursor < visualLines.length) {
    const availableHeight = state.options.page.resolved.contentBottomPt - state.cursorYPt;
    const maxLinesOnPage = Math.floor(
      Math.max(0, availableHeight - paddingPt * 2) / lineHeightPt
    );

    if (maxLinesOnPage <= 0) {
      addPage(state);
      continue;
    }

    const lineCount = Math.min(maxLinesOnPage, visualLines.length - cursor);
    const chunkHeight = lineCount * lineHeightPt + paddingPt * 2;
    ensureVerticalSpace(chunkHeight, state);

    const blockX = resolved.contentXPt;
    const blockY = state.cursorYPt;

    if (codeOptions.background) {
      state.currentPage.ops.push({
        kind: "rule",
        xPt: blockX,
        yPt: blockY,
        wPt: resolved.contentWPt,
        hPt: chunkHeight,
        colorRgb: [0.96, 0.96, 0.96]
      });
    }

    if (codeOptions.border) {
      const linePt = 0.6;
      drawRectBorder(state.currentPage.ops, blockX, blockY, resolved.contentWPt, chunkHeight, linePt);
    }

    let baseline = blockY + paddingPt + ascent;
    for (let i = 0; i < lineCount; i += 1) {
      const visual = visualLines[cursor + i];
      const leftX = blockX + paddingPt;

      if (codeOptions.lineNumbers && gutterWidthPt > 0) {
        const numberText = visual.lineNumber ? String(visual.lineNumber) : "";
        if (numberText) {
          const numberWidth = state.metrics.getTextWidth(fontId, numberText, lineNumberFontSize);
          emitTextSegment(
            numberText,
            fontId,
            lineNumberFontSize,
            leftX + gutterWidthPt - numberWidth - baseSize * 0.22,
            baseline,
            state.metrics,
            state.currentPage.ops,
            undefined,
            undefined,
            state,
            "code"
          );
        }

        state.currentPage.ops.push({
          kind: "rule",
          xPt: leftX + gutterWidthPt - baseSize * 0.1,
          yPt: baseline - ascent,
          wPt: 0.45,
          hPt: lineHeightPt,
          colorRgb: [0.8, 0.8, 0.8]
        });
      }

      emitTextSegment(
        visual.text,
        fontId,
        baseSize,
        leftX + gutterWidthPt,
        baseline,
        state.metrics,
        state.currentPage.ops,
        undefined,
        undefined,
        state,
        "code"
      );
      baseline += lineHeightPt;
    }

    state.cursorYPt += chunkHeight;
    cursor += lineCount;

    if (cursor < visualLines.length) {
      addPage(state);
    }
  }
}

function layoutDisplayMath(expr: string, state: LayoutState): void {
  const fontSizePt = state.options.typography.baseFontSizePt * 1.08;
  const beforePt = state.options.typography.paragraphSpacingPt * 1.2;
  const afterPt = state.options.typography.paragraphSpacingPt * 1.2;

  let box: MathBox;
  try {
    box = getMathBox(expr, fontSizePt, true, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.diagnostics.errors.push(
      `Display math parse/layout failed for "${expr}": ${message}`
    );
    layoutParagraph(
      formatMathErrorText(message),
      {
        fontId: state.options.fonts.text.id,
        codeFontId: state.options.fonts.mono?.id ?? state.options.fonts.text.id,
        fontSizePt,
        lineHeightMult: state.options.typography.lineHeight,
        afterPt,
        firstLineIndentPt: 0,
        hangingIndentPt: 0,
        parseInline: false,
        role: "paragraph"
      },
      state
    );
    return;
  }

  const resolved = state.options.page.resolved;
  if (box.w > resolved.contentWPt) {
    state.diagnostics.warnings.push(
      `Display math width ${box.w.toFixed(2)}pt exceeds content width ${resolved.contentWPt.toFixed(
        2
      )}pt and may overflow.`
    );
  }

  state.cursorYPt += beforePt;
  const lineHeightPt = Math.max(
    fontSizePt * state.options.typography.lineHeight,
    box.a + box.d + 2
  );
  ensureVerticalSpace(lineHeightPt, state);

  const baselinePt = state.cursorYPt + Math.max(0, (lineHeightPt - (box.a + box.d)) / 2) + box.a;
  const xPt = resolved.contentXPt + (resolved.contentWPt - box.w) / 2;
  box.emit(xPt, baselinePt, state.currentPage.ops);

  state.cursorYPt += lineHeightPt + afterPt;
}

function layoutTableBlock(
  block: Extract<MarkdownBlock, { kind: "table" }>,
  state: LayoutState
): void {
  const resolved = state.options.page.resolved;
  const fontId = state.options.fonts.text.id;
  const codeFontId = state.options.fonts.mono?.id ?? fontId;
  const fontSizePt = state.options.typography.baseFontSizePt * 0.94;
  const lineHeightPt = Math.max(
    fontSizePt * 1.25,
    state.metrics.getAscent(fontId, fontSizePt) + state.metrics.getDescent(fontId, fontSizePt) + 1
  );

  const paddingXPt = fontSizePt * 0.45;
  const paddingYPt = fontSizePt * 0.26;
  const borderPt = 0.65;
  const beforePt = state.options.typography.paragraphSpacingPt * 0.5;
  const afterPt = state.options.typography.paragraphSpacingPt * 0.85;

  const colCount = Math.max(1, block.header.length);
  const align = normalizeTableAlignment(block.align, colCount);
  const cellStyle: ParagraphStyle = {
    fontId,
    codeFontId,
    fontSizePt,
    lineHeightMult: state.options.typography.lineHeight,
    afterPt: 0,
    firstLineIndentPt: 0,
    hangingIndentPt: 0,
    parseInline: true,
    role: "tableCell"
  };

  const naturalWidths = new Array<number>(colCount).fill(fontSizePt * 5);
  const minWidths = new Array<number>(colCount).fill(fontSizePt * 3.4 + paddingXPt * 2);

  const allRows = [block.header, ...block.rows];
  for (const row of allRows) {
    for (let col = 0; col < colCount; col += 1) {
      const cell = normalizeCellText(row[col] ?? "");
      const fragments = parseParagraphFragments(cell, cellStyle, state);
      const width = measureInlineFragmentsMaxLineWidth(
        fragments,
        state.metrics,
        fontId,
        fontSizePt
      ) + paddingXPt * 2;
      naturalWidths[col] = Math.max(naturalWidths[col], width);
    }
  }

  const colWidths = fitColumnWidths(naturalWidths, minWidths, resolved.contentWPt);
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);

  const headerLayout = buildTableRowLayout(
    block.header,
    colWidths,
    lineHeightPt,
    paddingXPt,
    paddingYPt,
    cellStyle,
    state
  );

  const bodyLayouts = block.rows.map((row) =>
    buildTableRowLayout(
      row,
      colWidths,
      lineHeightPt,
      paddingXPt,
      paddingYPt,
      cellStyle,
      state
    )
  );

  state.cursorYPt += beforePt;

  let bodyIndex = 0;
  while (true) {
    if (state.cursorYPt + headerLayout.heightPt > resolved.contentBottomPt) {
      addPage(state);
    }

    const available = resolved.contentBottomPt - state.cursorYPt;
    let usedHeight = headerLayout.heightPt;
    let endIndex = bodyIndex;

    if (bodyLayouts.length === 0 && bodyIndex === 0) {
      drawTableChunk(
        state,
        resolved.contentXPt,
        state.cursorYPt,
        tableWidth,
        colWidths,
        align,
        headerLayout,
        [],
        paddingXPt,
        paddingYPt,
        borderPt
      );
      state.cursorYPt += usedHeight;
      break;
    }

    while (endIndex < bodyLayouts.length) {
      const nextHeight = bodyLayouts[endIndex].heightPt;
      if (endIndex === bodyIndex && usedHeight + nextHeight > available) {
        addPage(state);
        usedHeight = headerLayout.heightPt;
        continue;
      }
      if (usedHeight + nextHeight > available) {
        break;
      }
      usedHeight += nextHeight;
      endIndex += 1;
    }

    const chunkRows = bodyLayouts.slice(bodyIndex, endIndex);
    drawTableChunk(
      state,
      resolved.contentXPt,
      state.cursorYPt,
      tableWidth,
      colWidths,
      align,
      headerLayout,
      chunkRows,
      paddingXPt,
      paddingYPt,
      borderPt
    );

    state.cursorYPt += usedHeight;
    bodyIndex = endIndex;

    if (bodyIndex >= bodyLayouts.length) {
      break;
    }

    addPage(state);
  }

  state.cursorYPt += afterPt;
}

function drawTableChunk(
  state: LayoutState,
  xPt: number,
  yPt: number,
  tableWidthPt: number,
  colWidthsPt: number[],
  align: TableAlign[],
  header: TableRowLayout,
  rows: TableRowLayout[],
  paddingXPt: number,
  paddingYPt: number,
  borderPt: number
): void {
  const ops = state.currentPage.ops;
  const lineColor: [number, number, number] = [0, 0, 0];

  const chunkHeightPt =
    header.heightPt + rows.reduce((sum, row) => sum + row.heightPt, 0);

  ops.push({
    kind: "rule",
    xPt,
    yPt,
    wPt: tableWidthPt,
    hPt: header.heightPt,
    colorRgb: [0.94, 0.94, 0.94]
  });

  drawRectBorder(ops, xPt, yPt, tableWidthPt, chunkHeightPt, borderPt);

  let cursorX = xPt;
  for (let col = 0; col < colWidthsPt.length - 1; col += 1) {
    cursorX += colWidthsPt[col];
    ops.push({
      kind: "rule",
      xPt: cursorX - borderPt / 2,
      yPt,
      wPt: borderPt,
      hPt: chunkHeightPt,
      colorRgb: lineColor
    });
  }

  let rowY = yPt;
  drawTableRowText(
    state,
    header,
    rowY,
    xPt,
    colWidthsPt,
    align,
    paddingXPt,
    paddingYPt
  );

  rowY += header.heightPt;
  ops.push({
    kind: "rule",
    xPt,
    yPt: rowY - borderPt / 2,
    wPt: tableWidthPt,
    hPt: borderPt,
    colorRgb: lineColor
  });

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    drawTableRowText(
      state,
      row,
      rowY,
      xPt,
      colWidthsPt,
      align,
      paddingXPt,
      paddingYPt
    );
    rowY += row.heightPt;
    if (i < rows.length - 1) {
      ops.push({
        kind: "rule",
        xPt,
        yPt: rowY - borderPt / 2,
        wPt: tableWidthPt,
        hPt: borderPt,
        colorRgb: [0.35, 0.35, 0.35]
      });
    }
  }
}

function drawTableRowText(
  state: LayoutState,
  row: TableRowLayout,
  yPt: number,
  xPt: number,
  colWidthsPt: number[],
  align: TableAlign[],
  paddingXPt: number,
  paddingYPt: number
): void {
  let cursorX = xPt;
  for (let col = 0; col < colWidthsPt.length; col += 1) {
    const cell = row.cells[col];
    if (!cell) {
      cursorX += colWidthsPt[col];
      continue;
    }
    let lineTop = yPt + paddingYPt;

    for (const line of cell.lines) {
      const textX =
        align[col] === "center"
          ? cursorX + (colWidthsPt[col] - line.widthPt) / 2
          : align[col] === "right"
            ? cursorX + colWidthsPt[col] - paddingXPt - line.widthPt
            : cursorX + paddingXPt;
      const baseline = lineTop + line.ascentPt;

      let runX = textX;
      for (const fragment of line.fragments) {
        emitFragment(
          fragment,
          runX,
          baseline,
          state.currentPage.ops,
          state.metrics,
          state,
          "tableCell"
        );
        runX += fragment.width;
      }

      lineTop += line.heightPt;
    }

    cursorX += colWidthsPt[col];
  }
}

function buildTableRowLayout(
  row: string[],
  colWidthsPt: number[],
  lineHeightPt: number,
  paddingXPt: number,
  paddingYPt: number,
  style: ParagraphStyle,
  state: LayoutState
): TableRowLayout {
  const cells: TableCellLayout[] = [];
  let maxContentHeightPt = lineHeightPt;

  for (let col = 0; col < colWidthsPt.length; col += 1) {
    const contentWidth = Math.max(1, colWidthsPt[col] - paddingXPt * 2);
    const normalized = normalizeCellText(row[col] ?? "");
    const fragments = parseParagraphFragments(normalized, style, state);
    const lines = wrapInlineFragmentsForCell(fragments, style, contentWidth, state);
    const contentHeightPt = lines.reduce((sum, line) => sum + line.heightPt, 0);
    cells.push({ lines, contentHeightPt });
    maxContentHeightPt = Math.max(maxContentHeightPt, contentHeightPt);
  }

  return {
    cells,
    heightPt: maxContentHeightPt + paddingYPt * 2
  };
}

function normalizeTableAlignment(align: TableAlign[], colCount: number): TableAlign[] {
  const out: TableAlign[] = [];
  for (let i = 0; i < colCount; i += 1) {
    out.push(align[i] ?? "left");
  }
  return out;
}

function fitColumnWidths(
  natural: number[],
  min: number[],
  maxTotal: number
): number[] {
  const widths = natural.slice();
  let total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= maxTotal) {
    return widths;
  }

  let overflow = total - maxTotal;
  let safety = 0;

  while (overflow > 0.001 && safety < 24) {
    safety += 1;
    const flex = widths.map((width, idx) => Math.max(0, width - min[idx]));
    const flexTotal = flex.reduce((sum, width) => sum + width, 0);
    if (flexTotal <= 0.001) {
      break;
    }

    for (let i = 0; i < widths.length; i += 1) {
      if (flex[i] <= 0) {
        continue;
      }
      const cut = Math.min(flex[i], overflow * (flex[i] / flexTotal));
      widths[i] -= cut;
      overflow -= cut;
    }
  }

  total = widths.reduce((sum, width) => sum + width, 0);
  if (total > maxTotal && total > 0) {
    const scale = maxTotal / total;
    for (let i = 0; i < widths.length; i += 1) {
      widths[i] = Math.max(min[i], widths[i] * scale);
    }
  }

  return widths;
}

function measureInlineFragmentsMaxLineWidth(
  fragments: InlineFragment[],
  metrics: FontMetricsProvider,
  fontId: string,
  fontSizePt: number
): number {
  if (fragments.length === 0) {
    return metrics.getTextWidth(fontId, " ", fontSizePt);
  }

  let maxWidth = 0;
  let currentWidth = 0;
  for (const fragment of fragments) {
    if (fragment.kind === "break") {
      maxWidth = Math.max(maxWidth, currentWidth);
      currentWidth = 0;
      continue;
    }
    currentWidth += fragment.width;
  }
  return Math.max(maxWidth, currentWidth);
}

function wrapInlineFragmentsForCell(
  sourceFragments: InlineFragment[],
  style: ParagraphStyle,
  maxWidthPt: number,
  state: LayoutState
): TableLineLayout[] {
  const fragments = sourceFragments.slice();
  const lines: TableLineLayout[] = [];
  const baseAscent = state.metrics.getAscent(style.fontId, style.fontSizePt);
  const baseDescent = state.metrics.getDescent(style.fontId, style.fontSizePt);
  const maxWidth = Math.max(1, maxWidthPt);
  let idx = 0;

  while (idx < fragments.length) {
    const lineFragments: InlineFragment[] = [];
    let lineWidthPt = 0;
    let forcedBreak = false;

    while (idx < fragments.length) {
      let fragment = fragments[idx];

      if (fragment.kind === "break") {
        idx += 1;
        forcedBreak = true;
        break;
      }

      if (fragment.isSpace && lineFragments.length === 0) {
        idx += 1;
        continue;
      }

      if (
        lineFragments.length === 0 &&
        fragment.kind === "text" &&
        fragment.allowCharBreak &&
        fragment.width > maxWidth
      ) {
        const split = splitTextFragmentToWidth(fragment, maxWidth, style, state);
        if (split.head) {
          fragment = split.head;
          lineFragments.push(fragment);
          lineWidthPt += fragment.width;
          if (split.tail) {
            fragments[idx] = split.tail;
          } else {
            idx += 1;
          }
          break;
        }
      }

      if (lineWidthPt + fragment.width <= maxWidth || lineFragments.length === 0) {
        lineFragments.push(fragment);
        lineWidthPt += fragment.width;
        idx += 1;
        continue;
      }

      break;
    }

    trimTrailingSpaces(lineFragments);
    if (lineFragments.length === 0) {
      if (forcedBreak) {
        lines.push({
          fragments: [],
          widthPt: 0,
          ascentPt: baseAscent,
          descentPt: baseDescent,
          heightPt: Math.max(style.fontSizePt * style.lineHeightMult, baseAscent + baseDescent + 1)
        });
      }
      continue;
    }

    const widthPt = lineFragments.reduce((sum, fragment) => sum + fragment.width, 0);
    const ascentPt = Math.max(baseAscent, ...lineFragments.map((fragment) => fragment.ascent));
    const descentPt = Math.max(baseDescent, ...lineFragments.map((fragment) => fragment.descent));
    const naturalHeightPt = ascentPt + descentPt;
    const heightPt = Math.max(style.fontSizePt * style.lineHeightMult, naturalHeightPt + 1);

    lines.push({
      fragments: lineFragments,
      widthPt,
      ascentPt,
      descentPt,
      heightPt
    });
  }

  if (lines.length === 0) {
    lines.push({
      fragments: [],
      widthPt: 0,
      ascentPt: baseAscent,
      descentPt: baseDescent,
      heightPt: Math.max(style.fontSizePt * style.lineHeightMult, baseAscent + baseDescent + 1)
    });
  }

  return lines;
}

function wrapLineByCharacters(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider,
  maxWidthPt: number
): string[] {
  if (text.length === 0) {
    return [""];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const split = splitTextToWidth(remaining, fontId, fontSizePt, metrics, maxWidthPt);
    const head = split.head || remaining[0];
    parts.push(head);
    remaining = split.tail;
  }

  return parts;
}

function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatMathErrorText(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  const trimmed =
    normalized.length > 72 ? `${normalized.slice(0, 69).trimEnd()}...` : normalized;
  return `[math error: ${trimmed || "unknown"}]`;
}

function createInitialState(
  options: NormalizedTypesetOptions,
  diagnostics: TypesetDiagnostics,
  metrics: FontMetricsProvider
): LayoutState {
  const firstPage: PageLayout = {
    index: 0,
    widthPt: options.page.resolved.widthPt,
    heightPt: options.page.resolved.heightPt,
    ops: []
  };

  return {
    pages: [firstPage],
    currentPage: firstPage,
    cursorYPt: options.page.resolved.contentYPt,
    diagnostics,
    options,
    metrics,
    mathCache: new Map<string, MathBox>(),
    spanCounter: 0
  };
}

function addPage(state: LayoutState): void {
  const nextPage: PageLayout = {
    index: state.pages.length,
    widthPt: state.options.page.resolved.widthPt,
    heightPt: state.options.page.resolved.heightPt,
    ops: []
  };
  state.pages.push(nextPage);
  state.currentPage = nextPage;
  state.cursorYPt = state.options.page.resolved.contentYPt;
}

function ensureVerticalSpace(heightPt: number, state: LayoutState): void {
  if (state.cursorYPt + heightPt <= state.options.page.resolved.contentBottomPt) {
    return;
  }
  addPage(state);
}

function ensureKeepWithNext(
  headingFontSizePt: number,
  next: MarkdownBlock | null,
  state: LayoutState
): void {
  if (!next) {
    return;
  }

  const bodySizePt = state.options.typography.baseFontSizePt;
  const headingHeight = Math.max(
    headingFontSizePt * 1.15,
    state.metrics.getAscent(state.options.fonts.text.id, headingFontSizePt) +
      state.metrics.getDescent(state.options.fonts.text.id, headingFontSizePt)
  );
  const bodyLineHeight = bodySizePt * state.options.typography.lineHeight;
  const estimate = headingHeight + bodyLineHeight * 2;
  const remaining = state.options.page.resolved.contentBottomPt - state.cursorYPt;
  if (remaining < estimate) {
    addPage(state);
  }
}

function getMathBox(
  expr: string,
  fontSizePt: number,
  displayMode: boolean,
  state: LayoutState
): MathBox {
  const key = `${displayMode ? "d" : "i"}:${fontSizePt.toFixed(3)}:${expr}`;
  const cached = state.mathCache.get(key);
  if (cached) {
    // Math layout is expensive; cache by expression + size + display mode.
    return cached;
  }

  const box = layoutMathExpression(expr, {
    metrics: state.metrics,
    fontId: state.options.fonts.math.id,
    textFontId: state.options.fonts.text.id,
    monoFontId: state.options.fonts.mono?.id,
    baseFontSizePt: fontSizePt,
    displayMode,
    features: state.options.features.math
  });

  state.mathCache.set(key, box);
  return box;
}

function emitFragment(
  fragment: InlineFragment,
  xPt: number,
  baselinePt: number,
  ops: DrawOp[],
  metrics: FontMetricsProvider,
  state: LayoutState,
  role: SpanRole
): void {
  if (fragment.kind === "break") {
    return;
  }

  if (fragment.kind === "math") {
    fragment.box.emit(xPt, baselinePt, ops);
    return;
  }

  emitTextSegment(
    fragment.text,
    fragment.fontId,
    fragment.fontSizePt,
    xPt,
    baselinePt,
    metrics,
    ops,
    fragment.charWidths,
    fragment,
    state,
    role
  );

  if (fragment.strike) {
    const strike = metrics.getStrikeMetrics(fragment.fontId, fragment.fontSizePt);
    const yPt = baselinePt + strike.offsetPt - strike.thicknessPt / 2;
    ops.push({
      kind: "strikethrough",
      xPt,
      yPt,
      wPt: fragment.width,
      thicknessPt: strike.thicknessPt
    });
  }

  if (fragment.linkHref) {
    if (state.options.features.typography.linkUnderline) {
      const typography = state.options.features.typography;
      const underline = metrics.getUnderlineMetrics(fragment.fontId, fragment.fontSizePt);
      let offsetPt = underline.offsetPt;
      let thicknessPt = underline.thicknessPt;

      if (typography.linkUnderlineMode === "smart") {
        const minOffsetPt = Math.max(
          fragment.fontSizePt * typography.linkUnderlineMinOffsetEm,
          fragment.descent * 0.62
        );
        const minThicknessPt = Math.max(0.4, fragment.fontSizePt * 0.03);
        const maxThicknessPt = Math.max(
          minThicknessPt,
          fragment.fontSizePt * typography.linkUnderlineMaxThicknessEm
        );
        offsetPt = Math.max(offsetPt, minOffsetPt);
        thicknessPt = Math.min(Math.max(thicknessPt, minThicknessPt), maxThicknessPt);
      }

      const underlineY = baselinePt + offsetPt - thicknessPt / 2;
      ops.push({
        kind: "underline",
        xPt,
        yPt: underlineY,
        wPt: fragment.width,
        thicknessPt,
        colorRgb: [0.1, 0.2, 0.85]
      });
    }
    ops.push({
      kind: "link",
      xPt,
      yPt: baselinePt - fragment.ascent,
      wPt: fragment.width,
      hPt: fragment.ascent + fragment.descent,
      href: fragment.linkHref
    });
  }

  if (state.options.features.typography.debugDecorations && (fragment.strike || fragment.linkHref)) {
    ops.push({
      kind: "rule",
      xPt,
      yPt: baselinePt - 0.2,
      wPt: fragment.width,
      hPt: 0.4,
      colorRgb: [0.9, 0.2, 0.2]
    });
  }
}

function emitTextSegment(
  text: string,
  fontId: string,
  fontSizePt: number,
  xPt: number,
  yBaselinePt: number,
  metrics: FontMetricsProvider,
  ops: DrawOp[],
  precomputedCharWidths?: number[],
  fragment?: TextFragment,
  state?: LayoutState,
  role: SpanRole = "paragraph"
): void {
  if (!text) {
    return;
  }

  let runX = xPt;
  // Group adjacent characters that resolve to the same concrete font.
  let runFontId = metrics.resolveFontForChar(fontId, text[0]);
  let runOffsets: number[] = [0];
  let runText = text[0];
  let runAdvance = precomputedCharWidths?.[0] ?? metrics.getAdvanceWidth(fontId, text[0], fontSizePt);

  const flushRun = (): void => {
    if (!runText) {
      return;
    }
    const glyphRun: GlyphRunOp = {
      kind: "glyphRun",
      fontId: runFontId,
      fontSizePt,
      xPt: runX,
      yBaselinePt,
      text: runText,
      xOffsetsPt: runOffsets
    };

    const effectiveRole: SpanRole = fragment?.sourceKind === "math" ? "mathText" : role;
    if (state) {
      ops.push({
        kind: "textSpan",
        id: `span-${state.spanCounter++}`,
        role: effectiveRole,
        ops: [glyphRun]
      });
    } else {
      ops.push(glyphRun);
    }
  };

  for (let i = 1; i < text.length; i += 1) {
    const char = text[i];
    const resolvedFont = metrics.resolveFontForChar(fontId, char);
    const width = precomputedCharWidths?.[i] ?? metrics.getAdvanceWidth(fontId, char, fontSizePt);
    if (resolvedFont !== runFontId) {
      flushRun();
      runX += runAdvance;
      runFontId = resolvedFont;
      runText = char;
      runOffsets = [0];
      runAdvance = width;
      continue;
    }

    runText += char;
    runOffsets.push(runAdvance);
    runAdvance += width;
  }

  flushRun();
}

function createTextFragmentsFromText(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider,
  style?: InlineTextStyle
): TextFragment[] {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  return parts.map((part) =>
    createTextFragment(part, fontId, fontSizePt, metrics, /^\s+$/.test(part), true, {
      bold: style?.bold ?? false,
      italic: style?.italic ?? false,
      strike: style?.strike ?? false,
      linkHref: style?.href,
      sourceKind: "markdown"
    })
  );
}

function createTextFragment(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider,
  isSpace: boolean,
  allowCharBreak: boolean,
  style?: {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    linkHref?: string;
    sourceKind?: "markdown" | "math";
  }
): TextFragment {
  const charWidths: number[] = [];
  let width = 0;
  for (const char of text) {
    const w = metrics.getAdvanceWidth(fontId, char, fontSizePt);
    charWidths.push(w);
    width += w;
  }

  return {
    kind: "text",
    text,
    fontId,
    fontSizePt,
    width,
    ascent: metrics.getAscent(fontId, fontSizePt),
    descent: metrics.getDescent(fontId, fontSizePt),
    isSpace,
    allowCharBreak,
    charWidths,
    bold: style?.bold ?? false,
    italic: style?.italic ?? false,
    strike: style?.strike ?? false,
    linkHref: style?.linkHref,
    sourceKind: style?.sourceKind ?? "markdown"
  };
}

function splitTextFragmentToWidth(
  fragment: TextFragment,
  maxWidthPt: number,
  style: ParagraphStyle,
  state: LayoutState
): { head: TextFragment | null; tail: TextFragment | null } {
  if (fragment.width <= maxWidthPt || fragment.text.length < 2) {
    return { head: fragment, tail: null };
  }

  let width = 0;
  let splitIndex = 0;
  for (let i = 0; i < fragment.charWidths.length; i += 1) {
    const next = width + fragment.charWidths[i];
    if (next > maxWidthPt) {
      break;
    }
    width = next;
    splitIndex = i + 1;
  }

  if (splitIndex === 0) {
    splitIndex = 1;
  }

  if (state.options.features.typography.hyphenation && !fragment.isSpace) {
    const hyphenBreak = chooseHyphenBreak(fragment, splitIndex, maxWidthPt, style, state);
    if (hyphenBreak !== null) {
      splitIndex = hyphenBreak;
    }
  }

  const headText = fragment.text.slice(0, splitIndex);
  const tailText = fragment.text.slice(splitIndex);
  const appendHyphen =
    state.options.features.typography.hyphenation &&
    splitIndex < fragment.text.length &&
    /[A-Za-z]/.test(fragment.text);
  const hyphenWidth = appendHyphen
    ? state.metrics.getAdvanceWidth(fragment.fontId, "-", style.fontSizePt)
    : 0;

  const head: TextFragment = {
    ...fragment,
    text: appendHyphen ? `${headText}-` : headText,
    width:
      fragment.charWidths.slice(0, splitIndex).reduce((sum, x) => sum + x, 0) +
      hyphenWidth,
    charWidths: appendHyphen
      ? [...fragment.charWidths.slice(0, splitIndex), hyphenWidth]
      : fragment.charWidths.slice(0, splitIndex),
    isSpace: false
  };

  const tail =
    tailText.length > 0
      ? ({
          ...fragment,
          text: tailText,
          width: fragment.charWidths.slice(splitIndex).reduce((sum, x) => sum + x, 0),
          charWidths: fragment.charWidths.slice(splitIndex),
          isSpace: false
        } as TextFragment)
      : null;

  return { head, tail };
}

function chooseHyphenBreak(
  fragment: TextFragment,
  fallbackSplit: number,
  maxWidthPt: number,
  style: ParagraphStyle,
  state: LayoutState
): number | null {
  const text = fragment.text;
  if (!/^[A-Za-z]+$/.test(text)) {
    return null;
  }

  const minPrefix = Math.max(1, state.options.features.typography.hyphenMinPrefix);
  const minSuffix = Math.max(1, state.options.features.typography.hyphenMinSuffix);
  const hyphenWidth = state.metrics.getAdvanceWidth(fragment.fontId, "-", style.fontSizePt);
  const limit = Math.min(fallbackSplit, text.length - minSuffix);
  if (limit < minPrefix) {
    return null;
  }

  let best: number | null = null;
  for (let i = minPrefix; i <= limit; i += 1) {
    const lhs = text[i - 1];
    const rhs = text[i];
    if (!lhs || !rhs) {
      continue;
    }
    if (!isLikelyHyphenBoundary(lhs, rhs)) {
      continue;
    }
    const width =
      fragment.charWidths.slice(0, i).reduce((sum, x) => sum + x, 0) + hyphenWidth;
    if (width <= maxWidthPt) {
      best = i;
    }
  }

  return best;
}

function isLikelyHyphenBoundary(left: string, right: string): boolean {
  const vowels = new Set(["a", "e", "i", "o", "u", "y"]);
  const l = left.toLowerCase();
  const r = right.toLowerCase();
  return vowels.has(l) !== vowels.has(r);
}

function splitTextToWidth(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider,
  maxWidthPt: number
): { head: string; tail: string } {
  let width = 0;
  let splitIndex = 0;
  for (let i = 0; i < text.length; i += 1) {
    const charWidth = metrics.getAdvanceWidth(fontId, text[i], fontSizePt);
    if (width + charWidth > maxWidthPt) {
      break;
    }
    width += charWidth;
    splitIndex = i + 1;
  }
  if (splitIndex === 0) {
    splitIndex = 1;
  }
  return {
    head: text.slice(0, splitIndex),
    tail: text.slice(splitIndex)
  };
}

function applyJustificationSpacing(
  fragments: InlineFragment[],
  extraWidthPt: number
): number {
  const spaceFragments = fragments.filter(
    (fragment): fragment is TextFragment => fragment.kind === "text" && fragment.isSpace
  );
  if (spaceFragments.length === 0 || extraWidthPt <= 0) {
    return 0;
  }

  const perSpace = extraWidthPt / spaceFragments.length;
  let applied = 0;
  for (const fragment of spaceFragments) {
    fragment.width += perSpace;
    if (fragment.charWidths.length > 0) {
      fragment.charWidths[fragment.charWidths.length - 1] += perSpace;
    }
    applied += perSpace;
  }
  return applied;
}

function resolveStyledFontId(
  style: InlineTextStyle | undefined,
  defaultFontId: string,
  state: LayoutState
): string {
  if (!style || (!style.bold && !style.italic)) {
    return defaultFontId;
  }
  if (style.bold && style.italic && state.options.fonts.textBoldItalic) {
    return state.options.fonts.textBoldItalic.id;
  }
  if (style.bold && state.options.fonts.textBold) {
    return state.options.fonts.textBold.id;
  }
  if (style.italic && state.options.fonts.textItalic) {
    return state.options.fonts.textItalic.id;
  }
  return defaultFontId;
}

function expandTabs(text: string, tabSize: number): string {
  if (!text.includes("\t")) {
    return text;
  }

  let out = "";
  let col = 0;
  for (const char of text) {
    if (char === "\t") {
      const remainder = col % tabSize;
      const spaces = remainder === 0 ? tabSize : tabSize - remainder;
      out += " ".repeat(spaces);
      col += spaces;
      continue;
    }
    out += char;
    col += 1;
  }
  return out;
}

function trimTrailingSpaces(lineFragments: InlineFragment[]): void {
  while (lineFragments.length > 0 && lineFragments[lineFragments.length - 1].isSpace) {
    lineFragments.pop();
  }
}

function drawRectBorder(
  ops: DrawOp[],
  xPt: number,
  yPt: number,
  wPt: number,
  hPt: number,
  linePt: number
): void {
  ops.push({ kind: "rule", xPt, yPt, wPt, hPt: linePt });
  ops.push({ kind: "rule", xPt, yPt: yPt + hPt - linePt, wPt, hPt: linePt });
  ops.push({ kind: "rule", xPt, yPt, wPt: linePt, hPt });
  ops.push({ kind: "rule", xPt: xPt + wPt - linePt, yPt, wPt: linePt, hPt });
}

function performanceNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Replace header/footer placeholders with actual values.
 * Supported placeholders:
 * - {{pageNumber}} - Current page number (1-based)
 * - {{totalPages}} - Total number of pages
 * - {{date}} - Current date in ISO format (YYYY-MM-DD)
 * - {{date:FORMAT}} - Date with custom format
 */
function replacePlaceholders(
  text: string,
  pageIndex: number,
  totalPages: number
): string {
  if (!text) return text;

  const now = new Date();
  const isoDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

  let result = text;
  result = result.replace(/\{\{pageNumber\}\}/gi, String(pageIndex + 1));
  result = result.replace(/\{\{totalPages\}\}/gi, String(totalPages));
  result = result.replace(/\{\{date\}\}/gi, isoDate);

  // Handle custom date formats: {{date:FORMAT}}
  result = result.replace(/\{\{date:([^}]+)\}\}/gi, (_match, format: string) => {
    return formatDate(now, format);
  });

  return result;
}

/**
 * Simple date formatter supporting common patterns:
 * - YYYY: 4-digit year
 * - YY: 2-digit year
 * - MM: 2-digit month
 * - DD: 2-digit day
 * - HH: 2-digit hour (24h)
 * - mm: 2-digit minute
 * - ss: 2-digit second
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  return format
    .replace(/YYYY/g, String(year))
    .replace(/YY/g, String(year).slice(-2))
    .replace(/MM/g, String(month).padStart(2, "0"))
    .replace(/DD/g, String(day).padStart(2, "0"))
    .replace(/HH/g, String(hours).padStart(2, "0"))
    .replace(/mm/g, String(minutes).padStart(2, "0"))
    .replace(/ss/g, String(seconds).padStart(2, "0"));
}

/**
 * Add header and footer text to each page.
 * Headers appear in the top margin area, footers in the bottom margin area.
 */
function addHeadersAndFooters(
  pages: PageLayout[],
  options: NormalizedTypesetOptions,
  metrics: FontMetricsProvider
): void {
  const hf = options.headerFooter;
  const hasHeader = hf.header.left || hf.header.center || hf.header.right;
  const hasFooter = hf.footer.left || hf.footer.center || hf.footer.right;

  if (!hasHeader && !hasFooter) {
    return;
  }

  const totalPages = pages.length;
  const fontId = options.fonts.text.id;
  const fontSizePt = hf.fontSizePt;
  const resolved = options.page.resolved;
  const contentX = resolved.contentXPt;
  const contentW = resolved.contentWPt;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageIndex = i;

    // Skip first page if configured
    if (hf.skipFirstPage && pageIndex === 0) {
      continue;
    }

    // Add header
    if (hasHeader) {
      const headerY = resolved.headerYPt;

      // Left-aligned header text
      if (hf.header.left) {
        const text = replacePlaceholders(hf.header.left, pageIndex, totalPages);
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: contentX,
          yBaselinePt: headerY,
          text
        });
      }

      // Center-aligned header text
      if (hf.header.center) {
        const text = replacePlaceholders(hf.header.center, pageIndex, totalPages);
        const textWidth = metrics.getTextWidth(fontId, text, fontSizePt);
        const centerX = contentX + (contentW - textWidth) / 2;
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: centerX,
          yBaselinePt: headerY,
          text
        });
      }

      // Right-aligned header text
      if (hf.header.right) {
        const text = replacePlaceholders(hf.header.right, pageIndex, totalPages);
        const textWidth = metrics.getTextWidth(fontId, text, fontSizePt);
        const rightX = contentX + contentW - textWidth;
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: rightX,
          yBaselinePt: headerY,
          text
        });
      }

      // Add separator line below header if configured
      if (hf.showSeparator) {
        const separatorY = headerY + fontSizePt * 0.3;
        page.ops.push({
          kind: "rule",
          xPt: contentX,
          yPt: separatorY,
          wPt: contentW,
          hPt: 0.5
        });
      }
    }

    // Add footer
    if (hasFooter) {
      const footerY = resolved.footerYPt;

      // Left-aligned footer text
      if (hf.footer.left) {
        const text = replacePlaceholders(hf.footer.left, pageIndex, totalPages);
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: contentX,
          yBaselinePt: footerY,
          text
        });
      }

      // Center-aligned footer text
      if (hf.footer.center) {
        const text = replacePlaceholders(hf.footer.center, pageIndex, totalPages);
        const textWidth = metrics.getTextWidth(fontId, text, fontSizePt);
        const centerX = contentX + (contentW - textWidth) / 2;
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: centerX,
          yBaselinePt: footerY,
          text
        });
      }

      // Right-aligned footer text
      if (hf.footer.right) {
        const text = replacePlaceholders(hf.footer.right, pageIndex, totalPages);
        const textWidth = metrics.getTextWidth(fontId, text, fontSizePt);
        const rightX = contentX + contentW - textWidth;
        page.ops.push({
          kind: "glyphRun",
          fontId,
          fontSizePt,
          xPt: rightX,
          yBaselinePt: footerY,
          text
        });
      }

      // Add separator line above footer if configured
      if (hf.showSeparator) {
        const separatorY = footerY - fontSizePt * 0.8;
        page.ops.push({
          kind: "rule",
          xPt: contentX,
          yPt: separatorY,
          wPt: contentW,
          hPt: 0.5
        });
      }
    }
  }
}

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
  GlyphRunOp,
  NormalizedTypesetOptions,
  PageLayout,
  SourceMappingEntry,
  SourceSpan,
  TextSpanOp,
  TypesetDiagnostics,
  TypesetResult
} from "../types";
import { parseInlineNodes, type InlineTextStyle } from "./inline-parser";
import { splitGraphemes } from "../text/graphemes";
import { shouldUseEmojiMetricsFallback } from "../text/emoji";

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
  graphemes: string[];
  charWidths: number[];
  bold: boolean;
  italic: boolean;
  strike: boolean;
  linkHref?: string;
  sourceKind: "markdown" | "math";
  sourceSpan?: SourceSpan;
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

/**
 * Internal state for tracking source line Y positions during layout.
 */
type SourceLineYRange = {
  pageIndex: number;
  yStartPt: number;
  yEndPt: number;
};

type LayoutState = {
  pages: PageLayout[];
  currentPage: PageLayout;
  cursorYPt: number;
  diagnostics: TypesetDiagnostics;
  options: NormalizedTypesetOptions;
  metrics: FontMetricsProvider;
  mathCache: Map<string, MathBox>;
  spanCounter: number;
  /** Precomputed byte offsets where each source line starts (for offset→line conversion) */
  sourceLineStarts: number[];
  /** Accumulated Y ranges per source line number (1-indexed) */
  sourceLineRanges: Map<number, SourceLineYRange>;
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
  sourceSpan?: SourceSpan;
};

type CodeVisualLine = {
  text: string;
  lineNumber: number | null;
  sourceSpan?: SourceSpan;
};

type TableRowLayout = {
  cells: TableCellLayout[];
  heightPt: number;
  /** Source span for this row, used for source line tracking */
  sourceSpan?: SourceSpan;
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

type HeaderFooterInlineFragment = {
  text: string;
  fontId: string;
  fontSizePt: number;
  width: number;
  ascent: number;
  descent: number;
  strike: boolean;
  linkHref?: string;
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
  const blocks = parseMarkdownBlocks(markdown, { includeSourceSpans: true });
  diagnostics.timingsMs!.parseMarkdown = performanceNow() - parseStart;

  // Precompute line start offsets for source mapping
  const sourceLineStarts = computeSourceLineStarts(markdown);

  const state = createInitialState(options, diagnostics, metrics, sourceLineStarts);

  const layoutStart = performanceNow();
  // Layout stage owns all geometry decisions; renderers should be paint-only.
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const next = blocks[i + 1] ?? null;
    layoutBlock(block, next, state);
  }
  diagnostics.timingsMs!.layout = performanceNow() - layoutStart;

  // Add headers and footers to each page
  const hfStart = performanceNow();
  addHeadersAndFooters(state.pages, options, metrics, diagnostics);
  diagnostics.timingsMs!.headerFooter = performanceNow() - hfStart;

  // Build source mapping from accumulated ranges
  const sourceMapping = buildSourceMapping(state.sourceLineRanges);

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
          role: "heading",
          sourceSpan: block.sourceSpan
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
          role: "paragraph",
          sourceSpan: block.sourceSpan
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
      layoutBlockquote(block.depth, block.text, state, block.sourceSpan);
      break;
    }
    case "code": {
      state.cursorYPt += typography.paragraphSpacingPt * 0.35;
      layoutCodeBlock(block.lines, monoFontId, state, block.lineSourceSpans, block.sourceSpan);
      state.cursorYPt += typography.paragraphSpacingPt * 0.65;
      break;
    }
    case "displayMath": {
      layoutDisplayMath(block.expr, state, block.sourceSpan);
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
            role: "paragraph",
            sourceSpan: block.sourceSpan
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
      const ruleYPt = state.cursorYPt;
      state.currentPage.ops.push({
        kind: "rule",
        xPt: state.options.page.resolved.contentXPt,
        yPt: ruleYPt,
        wPt: state.options.page.resolved.contentWPt,
        hPt: 1
      });
      // Track horizontal rule source line
      trackSourceLineRange(
        block.sourceSpan,
        state.currentPage.index,
        ruleYPt - gap,
        ruleYPt + gap,
        state
      );
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
          true,
          { sourceSpan: style.sourceSpan },
          state.options
        )
      ];

  // Pass sourceSpan to fragment layout for per-line tracking
  layoutFragmentsIntoLines(fragments, style, state, style.sourceSpan);
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
          node.style,
          state.options,
          style.sourceSpan
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
            linkHref: codeStyle?.href,
            sourceSpan: style.sourceSpan
          },
          state.options
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
          true,
          { sourceSpan: style.sourceSpan },
          state.options
        )
      );
    }
  }

  return fragments;
}

function layoutFragmentsIntoLines(
  sourceFragments: InlineFragment[],
  style: ParagraphStyle,
  state: LayoutState,
  blockSourceSpan?: SourceSpan
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

    // Track actual Y position after potential page break
    const lineYStartPt = state.cursorYPt;

    const extraLead = Math.max(0, lineHeightPt - naturalHeight);
    const baselinePt = state.cursorYPt + extraLead / 2 + lineAscent;
    let xPt = resolved.contentXPt + indentPt;

    for (const fragment of lineFragments) {
      emitFragment(fragment, xPt, baselinePt, state.currentPage.ops, state.metrics, state, style.role);
      xPt += fragment.width;
    }

    state.cursorYPt += lineHeightPt;

    // Track source line range for this rendered line
    trackSourceLineRange(
      blockSourceSpan,
      state.currentPage.index,
      lineYStartPt,
      state.cursorYPt,
      state
    );

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
    const itemSourceSpan = block.itemSourceSpans?.[i] ?? block.sourceSpan;

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
        role: "listItem",
        sourceSpan: itemSourceSpan
      },
      state
    );
  }
}

function layoutBlockquote(
  depth: number,
  text: string,
  state: LayoutState,
  sourceSpan?: SourceSpan
): void {
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
      role: "paragraph",
      sourceSpan
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

function layoutCodeBlock(
  lines: string[],
  fontId: string,
  state: LayoutState,
  lineSourceSpans?: Array<SourceSpan | undefined>,
  blockSourceSpan?: SourceSpan
): void {
  const codeOptions = state.options.features.codeBlocks;
  const resolved = state.options.page.resolved;
  const baseSize = state.options.typography.baseFontSizePt * 0.9;
  const lineHeightPt = Math.max(
    baseSize * 1.28,
    state.metrics.getAscent(fontId, baseSize) + state.metrics.getDescent(fontId, baseSize) + 1
  );

  const tabSize = Math.max(1, codeOptions.tabSize);
  const normalizedLines = (lines.length === 0 ? [""] : lines).map((line) =>
    applyEmojiPolicyToText(expandTabs(line, tabSize), state.options)
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
        lineNumber: codeOptions.lineNumbers ? lineIndex + 1 : null,
        sourceSpan: lineSourceSpans?.[lineIndex] ?? blockSourceSpan
      });
      continue;
    }

    for (let i = 0; i < segments.length; i += 1) {
      visualLines.push({
        text: segments[i],
        lineNumber: codeOptions.lineNumbers && i === 0 ? lineIndex + 1 : null,
        sourceSpan: lineSourceSpans?.[lineIndex] ?? blockSourceSpan
      });
    }
  }

  if (visualLines.length === 0) {
    visualLines.push({ text: "", lineNumber: null, sourceSpan: blockSourceSpan });
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
        undefined,
        state,
        "code",
        visual.sourceSpan
      );

      // Track source line range for this code line
      trackSourceLineRange(
        visual.sourceSpan,
        state.currentPage.index,
        baseline - ascent,
        baseline + (lineHeightPt - ascent),
        state
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

function layoutDisplayMath(expr: string, state: LayoutState, sourceSpan?: SourceSpan): void {
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
        role: "paragraph",
        sourceSpan
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

  const startPageIndex = state.currentPage.index;
  const startYPt = state.cursorYPt;

  const baselinePt = state.cursorYPt + Math.max(0, (lineHeightPt - (box.a + box.d)) / 2) + box.a;
  const xPt = resolved.contentXPt + (resolved.contentWPt - box.w) / 2;
  box.emit(xPt, baselinePt, state.currentPage.ops);

  state.cursorYPt += lineHeightPt + afterPt;

  // Track source line range for display math
  trackSourceLineRange(
    sourceSpan,
    startPageIndex,
    startYPt,
    state.cursorYPt - afterPt,
    state
  );
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
    { ...cellStyle, sourceSpan: block.headerSourceSpan ?? block.sourceSpan },
    state
  );

  const bodyLayouts = block.rows.map((row, rowIndex) =>
    buildTableRowLayout(
      row,
      colWidths,
      lineHeightPt,
      paddingXPt,
      paddingYPt,
      { ...cellStyle, sourceSpan: block.rowSourceSpans?.[rowIndex] ?? block.sourceSpan },
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

  // Track header row source line
  trackSourceLineRange(
    header.sourceSpan,
    state.currentPage.index,
    rowY,
    rowY + header.heightPt,
    state
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
    const rowStartY = rowY;
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

    // Track body row source line
    trackSourceLineRange(
      row.sourceSpan,
      state.currentPage.index,
      rowStartY,
      rowY,
      state
    );

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
    heightPt: maxContentHeightPt + paddingYPt * 2,
    sourceSpan: style.sourceSpan
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
    const head = split.head || splitGraphemes(remaining)[0] || "";
    if (!head) {
      break;
    }
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
  metrics: FontMetricsProvider,
  sourceLineStarts: number[]
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
    spanCounter: 0,
    sourceLineStarts,
    sourceLineRanges: new Map()
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
    fragment.graphemes,
    fragment.charWidths,
    fragment,
    state,
    role,
    fragment.sourceSpan
  );

  if (fragment.strike) {
    const strike = metrics.getStrikeMetrics(fragment.fontId, fragment.fontSizePt);
    const yPt = baselinePt + strike.offsetPt - strike.thicknessPt / 2;
    ops.push({
      kind: "strikethrough",
      xPt,
      yPt,
      wPt: fragment.width,
      thicknessPt: strike.thicknessPt,
      sourceSpan: fragment.sourceSpan
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
        colorRgb: [0.1, 0.2, 0.85],
        sourceSpan: fragment.sourceSpan
      });
    }
    ops.push({
      kind: "link",
      xPt,
      yPt: baselinePt - fragment.ascent,
      wPt: fragment.width,
      hPt: fragment.ascent + fragment.descent,
      href: fragment.linkHref,
      sourceSpan: fragment.sourceSpan
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
  precomputedGraphemes?: string[],
  precomputedCharWidths?: number[],
  fragment?: TextFragment,
  state?: LayoutState,
  role: SpanRole = "paragraph",
  sourceSpan?: SourceSpan
): void {
  const graphemes = precomputedGraphemes ?? splitGraphemes(text);
  if (graphemes.length === 0) {
    return;
  }

  let runX = xPt;
  // Group adjacent characters that resolve to the same concrete font.
  let runFontId = metrics.resolveFontForChar(fontId, graphemes[0]);
  let runOffsets: number[] = [0];
  let runText = graphemes[0];
  let runAdvance =
    precomputedCharWidths?.[0] ?? metrics.getAdvanceWidth(fontId, graphemes[0], fontSizePt);

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
        ops: [glyphRun],
        sourceSpan
      });
    } else {
      ops.push(glyphRun);
    }
  };

  for (let i = 1; i < graphemes.length; i += 1) {
    const grapheme = graphemes[i];
    const resolvedFont = metrics.resolveFontForChar(fontId, grapheme);
    const width =
      precomputedCharWidths?.[i] ?? metrics.getAdvanceWidth(fontId, grapheme, fontSizePt);
    if (resolvedFont !== runFontId) {
      flushRun();
      runX += runAdvance;
      runFontId = resolvedFont;
      runText = grapheme;
      runOffsets = [0];
      runAdvance = width;
      continue;
    }

    runText += grapheme;
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
  style?: InlineTextStyle,
  optionsForEmojiPolicy?: Pick<NormalizedTypesetOptions, "features">,
  sourceSpan?: SourceSpan
): TextFragment[] {
  const policyText = optionsForEmojiPolicy
    ? applyEmojiPolicyToText(text, optionsForEmojiPolicy)
    : text;
  const parts = policyText.split(/(\s+)/).filter((part) => part.length > 0);
  const fragments: TextFragment[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isSpace = /^\s+$/.test(part);
    const fragment = createTextFragment(part, fontId, fontSizePt, metrics, isSpace, true, {
      bold: style?.bold ?? false,
      italic: style?.italic ?? false,
      strike: style?.strike ?? false,
      linkHref: style?.href,
      sourceKind: "markdown",
      sourceSpan
    });

    fragments.push(fragment);
  }

  return fragments;
}

function applyEmojiPolicyToText(
  text: string,
  options: Pick<NormalizedTypesetOptions, "features">
): string {
  if (!text || options.features.emoji.mode !== "suppress") {
    return text;
  }

  const replacement = options.features.emoji.replacement;
  const graphemes = splitGraphemes(text);
  let replaced = false;
  const out: string[] = [];

  for (const grapheme of graphemes) {
    if (shouldUseEmojiMetricsFallback(grapheme)) {
      out.push(replacement);
      replaced = true;
      continue;
    }
    out.push(grapheme);
  }

  return replaced ? out.join("") : text;
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
    sourceSpan?: SourceSpan;
  },
  optionsForEmojiPolicy?: Pick<NormalizedTypesetOptions, "features">
): TextFragment {
  const policyText = optionsForEmojiPolicy
    ? applyEmojiPolicyToText(text, optionsForEmojiPolicy)
    : text;
  const measured = measureTextBox(policyText, fontId, fontSizePt, metrics);

  return {
    kind: "text",
    text: policyText,
    fontId,
    fontSizePt,
    width: measured.width,
    ascent: measured.ascent,
    descent: measured.descent,
    isSpace,
    allowCharBreak,
    graphemes: measured.graphemes,
    charWidths: measured.charWidths,
    bold: style?.bold ?? false,
    italic: style?.italic ?? false,
    strike: style?.strike ?? false,
    linkHref: style?.linkHref,
    sourceKind: style?.sourceKind ?? "markdown",
    sourceSpan: style?.sourceSpan
  };
}

function measureTextBox(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider
): { graphemes: string[]; charWidths: number[]; width: number; ascent: number; descent: number } {
  const graphemes = splitGraphemes(text);
  const charWidths: number[] = [];
  let width = 0;
  let ascent = metrics.getAscent(fontId, fontSizePt);
  let descent = metrics.getDescent(fontId, fontSizePt);

  for (const grapheme of graphemes) {
    const glyph = metrics.getGlyphMetrics(fontId, grapheme, fontSizePt);
    charWidths.push(glyph.widthPt);
    width += glyph.widthPt;
    ascent = Math.max(ascent, glyph.ascentPt);
    descent = Math.max(descent, glyph.descentPt);
  }

  return { graphemes, charWidths, width, ascent, descent };
}

function splitTextFragmentToWidth(
  fragment: TextFragment,
  maxWidthPt: number,
  style: ParagraphStyle,
  state: LayoutState
): { head: TextFragment | null; tail: TextFragment | null } {
  if (fragment.width <= maxWidthPt || fragment.graphemes.length < 2) {
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

  const headGraphemes = fragment.graphemes.slice(0, splitIndex);
  const tailGraphemes = fragment.graphemes.slice(splitIndex);
  const headText = headGraphemes.join("");
  const tailText = tailGraphemes.join("");
  const appendHyphen =
    state.options.features.typography.hyphenation &&
    splitIndex < fragment.graphemes.length &&
    fragment.graphemes.some((grapheme) => /^[A-Za-z]$/.test(grapheme));
  const hyphenWidth = appendHyphen
    ? state.metrics.getAdvanceWidth(fragment.fontId, "-", style.fontSizePt)
    : 0;

  const head: TextFragment = {
    ...fragment,
    text: appendHyphen ? `${headText}-` : headText,
    width:
      fragment.charWidths.slice(0, splitIndex).reduce((sum, x) => sum + x, 0) +
      hyphenWidth,
    graphemes: appendHyphen ? [...headGraphemes, "-"] : headGraphemes,
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
          graphemes: tailGraphemes,
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
  const graphemes = fragment.graphemes;
  if (!graphemes.every((grapheme) => /^[A-Za-z]$/.test(grapheme))) {
    return null;
  }

  const minPrefix = Math.max(1, state.options.features.typography.hyphenMinPrefix);
  const minSuffix = Math.max(1, state.options.features.typography.hyphenMinSuffix);
  const hyphenWidth = state.metrics.getAdvanceWidth(fragment.fontId, "-", style.fontSizePt);
  const limit = Math.min(fallbackSplit, graphemes.length - minSuffix);
  if (limit < minPrefix) {
    return null;
  }

  let best: number | null = null;
  for (let i = minPrefix; i <= limit; i += 1) {
    const lhs = graphemes[i - 1];
    const rhs = graphemes[i];
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
  const graphemes = splitGraphemes(text);
  let width = 0;
  let splitIndex = 0;
  for (let i = 0; i < graphemes.length; i += 1) {
    const graphemeWidth = metrics.getAdvanceWidth(fontId, graphemes[i], fontSizePt);
    if (width + graphemeWidth > maxWidthPt) {
      break;
    }
    width += graphemeWidth;
    splitIndex = i + 1;
  }
  if (splitIndex === 0) {
    splitIndex = 1;
  }
  return {
    head: graphemes.slice(0, splitIndex).join(""),
    tail: graphemes.slice(splitIndex).join("")
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
  return resolveStyledFontIdForOptions(style, defaultFontId, state.options);
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
 * - {{pageNumber:roman}} / {{totalPages:roman}} - Uppercase Roman numerals
 * - {{pageNumber:lower-roman}} / {{totalPages:lower-roman}} - Lowercase Roman numerals
 * - {{pageNumber:padN}} / {{totalPages:padN}} - Zero-padded decimal width N (e.g. pad3)
 * - {{date}} - Current date in ISO format (YYYY-MM-DD)
 * - {{date:FORMAT}} - Date with custom format
 */
function replacePlaceholders(
  text: string,
  pageIndex: number,
  totalPages: number,
  now: Date
): string {
  if (!text) {
    return text;
  }

  const isoDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

  let result = text;
  result = result.replace(
    /\{\{(pageNumber|totalPages)(?::([^}]+))?\}\}/gi,
    (_match, key: string, format: string | undefined) => {
      const value = key.toLowerCase() === "pagenumber" ? pageIndex + 1 : totalPages;
      return formatPageCounter(value, format);
    }
  );
  result = result.replace(/\{\{date\}\}/gi, isoDate);

  // Handle custom date formats: {{date:FORMAT}}
  result = result.replace(/\{\{date:([^}]+)\}\}/gi, (_match, format: string) => {
    return formatDate(now, format);
  });

  return result;
}

function formatPageCounter(value: number, format: string | undefined): string {
  if (!format) {
    return String(value);
  }

  const normalized = format.trim().toLowerCase();
  if (normalized === "roman" || normalized === "upper-roman") {
    return toRomanNumeral(value);
  }
  if (normalized === "lower-roman") {
    return toRomanNumeral(value).toLowerCase();
  }

  const pad = normalized.match(/^pad(\d{1,3})$/);
  if (pad) {
    const width = Math.max(1, Math.min(12, Number(pad[1])));
    return String(value).padStart(width, "0");
  }

  return String(value);
}

function toRomanNumeral(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || value >= 4000) {
    return String(value);
  }

  const map: Array<{ value: number; token: string }> = [
    { value: 1000, token: "M" },
    { value: 900, token: "CM" },
    { value: 500, token: "D" },
    { value: 400, token: "CD" },
    { value: 100, token: "C" },
    { value: 90, token: "XC" },
    { value: 50, token: "L" },
    { value: 40, token: "XL" },
    { value: 10, token: "X" },
    { value: 9, token: "IX" },
    { value: 5, token: "V" },
    { value: 4, token: "IV" },
    { value: 1, token: "I" }
  ];

  let remaining = Math.floor(value);
  let out = "";
  for (const entry of map) {
    while (remaining >= entry.value) {
      out += entry.token;
      remaining -= entry.value;
    }
    if (remaining === 0) {
      break;
    }
  }
  return out;
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
  metrics: FontMetricsProvider,
  diagnostics: TypesetDiagnostics
): void {
  const hf = options.headerFooter;
  const hasHeader = hf.header.left || hf.header.center || hf.header.right;
  const hasFooter = hf.footer.left || hf.footer.center || hf.footer.right;

  if (!hasHeader && !hasFooter) {
    return;
  }

  const totalPages = pages.length;
  const resolved = options.page.resolved;
  const contentX = resolved.contentXPt;
  const contentW = resolved.contentWPt;
  const now = new Date();
  const baselines = resolveHeaderFooterBaselines(options, metrics, diagnostics);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageIndex = i;

    // Skip first page if configured
    if (hf.skipFirstPage && pageIndex === 0) {
      continue;
    }

    // Add header
    if (hasHeader) {
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.header.left, pageIndex, totalPages, now),
        "left",
        baselines.headerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "header.left"
      );
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.header.center, pageIndex, totalPages, now),
        "center",
        baselines.headerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "header.center"
      );
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.header.right, pageIndex, totalPages, now),
        "right",
        baselines.headerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "header.right"
      );

      // Add separator line below header if configured
      if (hf.showSeparator && baselines.headerSeparatorYPt !== null) {
        page.ops.push({
          kind: "rule",
          xPt: contentX,
          yPt: baselines.headerSeparatorYPt,
          wPt: contentW,
          hPt: hf.separatorWidthPt
        });
      }
    }

    // Add footer
    if (hasFooter) {
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.footer.left, pageIndex, totalPages, now),
        "left",
        baselines.footerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "footer.left"
      );
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.footer.center, pageIndex, totalPages, now),
        "center",
        baselines.footerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "footer.center"
      );
      drawHeaderFooterSlot(
        page,
        replacePlaceholders(hf.footer.right, pageIndex, totalPages, now),
        "right",
        baselines.footerBaselinePt,
        contentX,
        contentW,
        options,
        metrics,
        diagnostics,
        "footer.right"
      );

      // Add separator line above footer if configured
      if (hf.showSeparator && baselines.footerSeparatorYPt !== null) {
        page.ops.push({
          kind: "rule",
          xPt: contentX,
          yPt: baselines.footerSeparatorYPt,
          wPt: contentW,
          hPt: hf.separatorWidthPt
        });
      }
    }
  }
}

function resolveHeaderFooterBaselines(
  options: NormalizedTypesetOptions,
  metrics: FontMetricsProvider,
  diagnostics: TypesetDiagnostics
): {
  headerBaselinePt: number;
  footerBaselinePt: number;
  headerSeparatorYPt: number | null;
  footerSeparatorYPt: number | null;
} {
  const resolved = options.page.resolved;
  const hf = options.headerFooter;
  const fontId = options.fonts.text.id;
  const ascent = metrics.getAscent(fontId, hf.fontSizePt);
  const descent = metrics.getDescent(fontId, hf.fontSizePt);
  const separatorReserve = hf.showSeparator ? hf.separatorGapPt + hf.separatorWidthPt : 0;

  const headerMin = Math.max(0.5 + ascent, ascent);
  const headerMax = resolved.contentYPt - descent - separatorReserve;
  let headerBaselinePt = resolved.headerYPt;
  if (headerMax < headerMin) {
    headerBaselinePt = headerMin;
    pushWarningOnce(
      diagnostics,
      "Header/footer: top margin is too small for configured header settings; header was pinned to the safest baseline."
    );
  } else {
    headerBaselinePt = clamp(resolved.headerYPt, headerMin, headerMax);
    if (Math.abs(headerBaselinePt - resolved.headerYPt) > 0.01) {
      pushWarningOnce(
        diagnostics,
        "Header/footer: header baseline was clamped to stay inside the top margin."
      );
    }
  }

  const footerMin = resolved.contentBottomPt + ascent + separatorReserve;
  const footerMax = resolved.heightPt - descent - 0.5;
  let footerBaselinePt = resolved.footerYPt;
  if (footerMin > footerMax) {
    footerBaselinePt = footerMax;
    pushWarningOnce(
      diagnostics,
      "Header/footer: bottom margin is too small for configured footer settings; footer was pinned to the safest baseline."
    );
  } else {
    footerBaselinePt = clamp(resolved.footerYPt, footerMin, footerMax);
    if (Math.abs(footerBaselinePt - resolved.footerYPt) > 0.01) {
      pushWarningOnce(
        diagnostics,
        "Header/footer: footer baseline was clamped to stay inside the bottom margin."
      );
    }
  }

  let headerSeparatorYPt: number | null = null;
  let footerSeparatorYPt: number | null = null;
  if (hf.showSeparator) {
    const idealHeaderSeparator = headerBaselinePt + descent + hf.separatorGapPt;
    const maxHeaderSeparator = resolved.contentYPt - hf.separatorWidthPt;
    headerSeparatorYPt = clamp(idealHeaderSeparator, 0, maxHeaderSeparator);
    if (Math.abs(headerSeparatorYPt - idealHeaderSeparator) > 0.01) {
      pushWarningOnce(
        diagnostics,
        "Header/footer: header separator was clamped to avoid overlapping main content."
      );
    }

    const idealFooterSeparator =
      footerBaselinePt - ascent - hf.separatorGapPt - hf.separatorWidthPt;
    const minFooterSeparator = resolved.contentBottomPt;
    footerSeparatorYPt = clamp(
      idealFooterSeparator,
      minFooterSeparator,
      resolved.heightPt - hf.separatorWidthPt
    );
    if (Math.abs(footerSeparatorYPt - idealFooterSeparator) > 0.01) {
      pushWarningOnce(
        diagnostics,
        "Header/footer: footer separator was clamped to avoid overlapping main content."
      );
    }
  }

  return {
    headerBaselinePt,
    footerBaselinePt,
    headerSeparatorYPt,
    footerSeparatorYPt
  };
}

function drawHeaderFooterSlot(
  page: PageLayout,
  text: string,
  alignment: "left" | "center" | "right",
  baselinePt: number,
  contentXPt: number,
  contentWPt: number,
  options: NormalizedTypesetOptions,
  metrics: FontMetricsProvider,
  diagnostics: TypesetDiagnostics,
  contextLabel: string
): void {
  if (!text) {
    return;
  }

  const fragments = parseHeaderFooterInlineFragments(text, options, metrics);
  if (fragments.length === 0) {
    return;
  }

  const width = fragments.reduce((sum, fragment) => sum + fragment.width, 0);
  if (width > contentWPt + 0.01) {
    pushWarningOnce(
      diagnostics,
      `Header/footer: ${contextLabel} exceeds available width and may be clipped.`
    );
  }

  let xPt = contentXPt;
  if (alignment === "center") {
    xPt = contentXPt + (contentWPt - width) / 2;
  } else if (alignment === "right") {
    xPt = contentXPt + contentWPt - width;
  }
  xPt = Math.max(contentXPt, xPt);

  for (const fragment of fragments) {
    emitTextSegment(
      fragment.text,
      fragment.fontId,
      fragment.fontSizePt,
      xPt,
      baselinePt,
      metrics,
      page.ops
    );

    if (fragment.strike) {
      const strike = metrics.getStrikeMetrics(fragment.fontId, fragment.fontSizePt);
      const yPt = baselinePt + strike.offsetPt - strike.thicknessPt / 2;
      page.ops.push({
        kind: "strikethrough",
        xPt,
        yPt,
        wPt: fragment.width,
        thicknessPt: strike.thicknessPt
      });
    }

    if (fragment.linkHref) {
      if (options.features.typography.linkUnderline) {
        const typography = options.features.typography;
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

        page.ops.push({
          kind: "underline",
          xPt,
          yPt: baselinePt + offsetPt - thicknessPt / 2,
          wPt: fragment.width,
          thicknessPt,
          colorRgb: [0.1, 0.2, 0.85]
        });
      }

      page.ops.push({
        kind: "link",
        xPt,
        yPt: baselinePt - fragment.ascent,
        wPt: fragment.width,
        hPt: fragment.ascent + fragment.descent,
        href: fragment.linkHref
      });
    }

    xPt += fragment.width;
  }
}

function parseHeaderFooterInlineFragments(
  text: string,
  options: NormalizedTypesetOptions,
  metrics: FontMetricsProvider
): HeaderFooterInlineFragment[] {
  const nodes = parseInlineNodes(text);
  const textFontId = options.fonts.text.id;
  const codeFontId = options.fonts.mono?.id ?? textFontId;
  const fontSizePt = options.headerFooter.fontSizePt;
  const out: HeaderFooterInlineFragment[] = [];

  for (const node of nodes) {
    if (node.kind === "lineBreak") {
      out.push(
        createHeaderFooterInlineFragment(
          " ",
          textFontId,
          fontSizePt,
          metrics,
          undefined,
          options
        )
      );
      continue;
    }

    if (node.kind === "text") {
      out.push(
        createHeaderFooterInlineFragment(
          node.text,
          resolveStyledFontIdForOptions(node.style, textFontId, options),
          fontSizePt,
          metrics,
          node.style,
          options
        )
      );
      continue;
    }

    if (node.kind === "code") {
      out.push(
        createHeaderFooterInlineFragment(
          node.code,
          codeFontId,
          fontSizePt * 0.94,
          metrics,
          node.style,
          options
        )
      );
      continue;
    }

    // Header/footer regions intentionally treat inline math as literal source.
    out.push(
      createHeaderFooterInlineFragment(
        `$${node.expr}$`,
        resolveStyledFontIdForOptions(node.style, textFontId, options),
        fontSizePt,
        metrics,
        node.style,
        options
      )
    );
  }

  return mergeHeaderFooterInlineFragments(out);
}

function createHeaderFooterInlineFragment(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider,
  style: InlineTextStyle | undefined,
  optionsForEmojiPolicy: Pick<NormalizedTypesetOptions, "features">
): HeaderFooterInlineFragment {
  const policyText = applyEmojiPolicyToText(text, optionsForEmojiPolicy);
  const measured = measureTextBox(policyText, fontId, fontSizePt, metrics);
  return {
    text: policyText,
    fontId,
    fontSizePt,
    width: measured.width,
    ascent: measured.ascent,
    descent: measured.descent,
    strike: style?.strike ?? false,
    linkHref: style?.href
  };
}

function mergeHeaderFooterInlineFragments(
  fragments: HeaderFooterInlineFragment[]
): HeaderFooterInlineFragment[] {
  const merged: HeaderFooterInlineFragment[] = [];
  for (const fragment of fragments) {
    if (!fragment.text) {
      continue;
    }
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.fontId === fragment.fontId &&
      Math.abs(prev.fontSizePt - fragment.fontSizePt) < 0.0001 &&
      prev.strike === fragment.strike &&
      (prev.linkHref ?? "") === (fragment.linkHref ?? "")
    ) {
      prev.text += fragment.text;
      prev.width += fragment.width;
      prev.ascent = Math.max(prev.ascent, fragment.ascent);
      prev.descent = Math.max(prev.descent, fragment.descent);
      continue;
    }
    merged.push({ ...fragment });
  }
  return merged;
}

function resolveStyledFontIdForOptions(
  style: InlineTextStyle | undefined,
  defaultFontId: string,
  options: Pick<NormalizedTypesetOptions, "fonts">
): string {
  if (!style || (!style.bold && !style.italic)) {
    return defaultFontId;
  }
  if (style.bold && style.italic && options.fonts.textBoldItalic) {
    return options.fonts.textBoldItalic.id;
  }
  if (style.bold && options.fonts.textBold) {
    return options.fonts.textBold.id;
  }
  if (style.italic && options.fonts.textItalic) {
    return options.fonts.textItalic.id;
  }
  return defaultFontId;
}

function pushWarningOnce(diagnostics: TypesetDiagnostics, message: string): void {
  if (!diagnostics.warnings.includes(message)) {
    diagnostics.warnings.push(message);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Line Mapping Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute byte offsets where each source line begins.
 * Returns an array where index i holds the byte offset of line (i+1).
 * Line numbers are 1-indexed in the result usage.
 */
function computeSourceLineStarts(source: string): number[] {
  const lineStarts: number[] = [0]; // Line 1 starts at offset 0
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\r") {
      if (source[i + 1] === "\n") {
        lineStarts.push(i + 2);
        i += 1; // Skip the \n
      } else {
        lineStarts.push(i + 1);
      }
    } else if (char === "\n") {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * Convert a byte offset to a 1-indexed line number using binary search.
 */
function offsetToLineNumber(offset: number, lineStarts: number[]): number {
  if (lineStarts.length === 0) {
    return 1;
  }

  let low = 0;
  let high = lineStarts.length - 1;
  let best = 0;
  const target = Math.max(0, Math.floor(offset));

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= target) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best + 1; // Convert to 1-indexed
}

/**
 * Track a rendered region for a source span, updating the sourceLineRanges map.
 */
function trackSourceLineRange(
  sourceSpan: SourceSpan | undefined,
  pageIndex: number,
  yStartPt: number,
  yEndPt: number,
  state: LayoutState
): void {
  if (!sourceSpan) {
    return;
  }

  const startLine = offsetToLineNumber(sourceSpan.start, state.sourceLineStarts);
  const endLine = offsetToLineNumber(
    Math.max(sourceSpan.start, sourceSpan.end - 1),
    state.sourceLineStarts
  );

  for (let line = startLine; line <= endLine; line += 1) {
    const existing = state.sourceLineRanges.get(line);
    if (!existing) {
      state.sourceLineRanges.set(line, {
        pageIndex,
        yStartPt,
        yEndPt: Math.max(yStartPt + 1, yEndPt)
      });
    } else if (existing.pageIndex === pageIndex) {
      // Extend the range on the same page
      existing.yStartPt = Math.min(existing.yStartPt, yStartPt);
      existing.yEndPt = Math.max(existing.yEndPt, yEndPt);
    } else if (pageIndex > existing.pageIndex) {
      // Content moved to a later page; prefer the later position
      existing.pageIndex = pageIndex;
      existing.yStartPt = yStartPt;
      existing.yEndPt = Math.max(yStartPt + 1, yEndPt);
    }
    // If existing.pageIndex > pageIndex, keep the existing (later page wins)
  }
}

/**
 * Build the final source mapping array from accumulated ranges.
 */
function buildSourceMapping(
  sourceLineRanges: Map<number, SourceLineYRange>
): SourceMappingEntry[] {
  const entries: SourceMappingEntry[] = [];

  for (const [lineNumber, range] of sourceLineRanges) {
    entries.push({
      sourceLineStart: lineNumber,
      sourceLineEnd: lineNumber,
      pageIndex: range.pageIndex,
      yStartPt: range.yStartPt,
      yEndPt: range.yEndPt
    });
  }

  // Sort by page, then Y position, then line number
  entries.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.yStartPt !== b.yStartPt) {
      return a.yStartPt - b.yStartPt;
    }
    return a.sourceLineStart - b.sourceLineStart;
  });

  return entries;
}

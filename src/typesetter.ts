/**
 * Typesetter module - bridges the integrated canvadoc-typesetter engine to the MD2PDF application.
 * This provides canvas-based rendering and client-side PDF export.
 */
import {
  createTypesetter,
  loadFontSpecFromUrl,
  mmToPt,
  type Typesetter,
  type DrawOp,
  type FontSpec,
  type PageLayout,
  type TypesetOptions,
  type CanvasViewOptions,
  type PdfOptions,
  type HeaderFooterConfig,
} from 'canvadoc-typesetter';

export type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';
export type EmojiMode = 'preserve' | 'suppress';

export interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
}

export interface SourceMappingEntry {
  sourceLineStart: number;
  sourceLineEnd: number;
  pageIndex: number;
  yStartPt: number;
  yEndPt: number;
}

const PAGE_SIZES: Record<PageSizeKey, PageSizeSpec> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  tabloid: { widthMm: 279.4, heightMm: 431.8 },
  a3: { widthMm: 297, heightMm: 420 },
};

interface FontSet {
  text: FontSpec;
  textBold: FontSpec;
  textItalic: FontSpec;
  textBoldItalic: FontSpec;
  math: FontSpec;
  mono: FontSpec;
  fallback: FontSpec[];
}

interface TypesetterConfig {
  pageSize: PageSizeKey;
  marginMm: number;
  fontSizePt: number;
  headerFooter?: HeaderFooterConfig;
  emojiMode?: EmojiMode;
}

interface TypesetResultWithOptionalSourceMapping {
  pages: PageLayout[];
  diagnostics: {
    warnings: string[];
    errors: string[];
  };
  sourceMapping?: unknown;
}

let fontsLoaded = false;
let loadedFonts: FontSet | null = null;
let typesetterInstance: Typesetter | null = null;
let currentConfigSignature: string | null = null;

// Optional emoji font downloads are disabled by default to avoid noisy 404s
// when deployments do not ship those files in /fonts.
// Set `globalThis.__MD2PDF_ENABLE_EMOJI_FONT_FETCH__ = true` before app init
// to re-enable probing these optional files.
const EMOJI_FALLBACK_FONT_FETCH_ENABLED =
  (globalThis as { __MD2PDF_ENABLE_EMOJI_FONT_FETCH__?: boolean }).__MD2PDF_ENABLE_EMOJI_FONT_FETCH__ === true;

type EmojiFallbackSpec = { id: string; url: string; cssFamily: string };
type EmojiFontProfile = 'compact' | 'full';

// `compact` keeps PDF size much smaller by avoiding very large color emoji fonts.
// Set `globalThis.__MD2PDF_EMOJI_FONT_PROFILE__ = 'full'` before app init
// to load maximum-coverage emoji fonts.
const EMOJI_FONT_PROFILE: EmojiFontProfile =
  (globalThis as { __MD2PDF_EMOJI_FONT_PROFILE__?: EmojiFontProfile }).__MD2PDF_EMOJI_FONT_PROFILE__ ?? 'compact';

const EMOJI_FALLBACKS_COMPACT: ReadonlyArray<EmojiFallbackSpec> = [
  { id: 'noto-emoji', url: './fonts/NotoEmoji-Regular.ttf', cssFamily: 'Noto Emoji' },
  { id: 'segoe-ui-symbol', url: './fonts/SegoeUISymbol.ttf', cssFamily: 'Segoe UI Symbol' },
];

const EMOJI_FALLBACKS_FULL: ReadonlyArray<EmojiFallbackSpec> = [
  ...EMOJI_FALLBACKS_COMPACT,
  { id: 'segoe-ui-emoji', url: './fonts/SegoeUIEmoji.ttf', cssFamily: 'Segoe UI Emoji' },
  { id: 'noto-color-emoji', url: './fonts/NotoColorEmoji.ttf', cssFamily: 'Noto Color Emoji' },
];

const BASELINE_GROUP_TOLERANCE_PT = 1.25;
const MIN_MAPPING_HEIGHT_PT = 1;
const LINE_MATCH_SEARCH_WINDOW = 48;
const MIN_LINE_MATCH_SCORE = 0.45;

/**
 * Load all required fonts. Call this once during app initialization.
 */
export async function loadFonts(): Promise<FontSet> {
  if (fontsLoaded && loadedFonts) {
    return loadedFonts;
  }

  const [textFont, textBold, textItalic, textBoldItalic, mathFont, monoFont, fallbackFonts] = await Promise.all([
    loadFontSpecFromUrl('source-serif', './fonts/SourceSerif4-Regular.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-bold', './fonts/SourceSerif4-Bold.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-italic', './fonts/SourceSerif4-Italic.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-bold-italic', './fonts/SourceSerif4-BoldItalic.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('stix-math', './fonts/STIXTwoMath-Regular.otf', 'STIX Two Math'),
    loadFontSpecFromUrl('ibm-plex-mono', './fonts/IBMPlexMono-Regular.otf', 'IBM Plex Mono'),
    loadOptionalEmojiFallbackFonts(),
  ]);

  loadedFonts = {
    text: textFont,
    textBold: textBold,
    textItalic: textItalic,
    textBoldItalic: textBoldItalic,
    math: mathFont,
    mono: monoFont,
    fallback: fallbackFonts,
  };

  fontsLoaded = true;
  return loadedFonts;
}

/**
 * Get or create a typesetter instance with the given configuration.
 */
export async function getTypesetter(config: TypesetterConfig): Promise<Typesetter> {
  const fonts = await loadFonts();
  const nextSignature = buildConfigSignature(config);

  if (typesetterInstance && currentConfigSignature === nextSignature) {
    return typesetterInstance;
  }

  const pageSpec = PAGE_SIZES[config.pageSize];
  const marginPt = mmToPt(config.marginMm);

  const options: TypesetOptions = {
    page: {
      size: {
        widthPt: mmToPt(pageSpec.widthMm),
        heightPt: mmToPt(pageSpec.heightMm),
      },
      margin: {
        top: marginPt,
        right: marginPt,
        bottom: marginPt,
        left: marginPt,
      },
    },
    headerFooter: config.headerFooter,
    typography: {
      baseFontSizePt: config.fontSizePt,
      lineHeight: 1.4,
      paragraphSpacingPt: config.fontSizePt,
      headingScale: {
        h1: 2.0,
        h2: 1.5,
        h3: 1.2,
      },
    },
    features: {
      emoji: {
        mode: config.emojiMode ?? 'preserve',
      },
    },
    fonts: {
      text: fonts.text,
      textBold: fonts.textBold,
      textItalic: fonts.textItalic,
      textBoldItalic: fonts.textBoldItalic,
      math: fonts.math,
      mono: fonts.mono,
      fallback: fonts.fallback,
    },
  };

  typesetterInstance = createTypesetter(options);
  currentConfigSignature = nextSignature;

  return typesetterInstance;
}

/**
 * Typeset markdown content and return the page layouts.
 */
export async function typesetMarkdown(
  markdown: string,
  config: TypesetterConfig
): Promise<{ pages: PageLayout[]; diagnostics: { warnings: string[]; errors: string[] }; sourceMapping?: SourceMappingEntry[] }> {
  const typesetter = await getTypesetter(config);
  const result = await typesetter.typeset(markdown) as TypesetResultWithOptionalSourceMapping;
  const sourceMapping =
    normalizeSourceMapping(result.sourceMapping) ??
    deriveSourceMappingFromSourceSpans(markdown, result.pages) ??
    deriveSourceMappingFromRenderedLines(markdown, result.pages);

  return {
    pages: result.pages,
    diagnostics: result.diagnostics,
    sourceMapping,
  };
}

/**
 * Render pages to a canvas element.
 */
export async function renderToCanvas(
  pages: PageLayout[],
  canvas: HTMLCanvasElement,
  config: TypesetterConfig,
  viewOptions: Partial<CanvasViewOptions> = {}
): Promise<void> {
  const typesetter = await getTypesetter(config);

  const defaultView: CanvasViewOptions = {
    zoom: 1,
    pageGapPt: 20,
    background: 'white',
    mode: 'stackedPages',
  };

  typesetter.renderToCanvas(pages, canvas, { ...defaultView, ...viewOptions });
}

/**
 * Generate a PDF from the given pages.
 */
export async function generatePdf(
  pages: PageLayout[],
  config: TypesetterConfig,
  pdfOptions: PdfOptions = {}
): Promise<Uint8Array> {
  const typesetter = await getTypesetter(config);
  return typesetter.renderToPdf(pages, pdfOptions);
}

/**
 * Helper to convert px-based font size to pt.
 * CSS pixels at 96dpi: 1pt = 96/72 px = 1.333... px
 */
export function pxToPt(px: number): number {
  return px * 72 / 96;
}

/**
 * Get page dimensions in pixels for a given page size (at 96 DPI).
 */
export function getPageDimensionsPx(pageSize: PageSizeKey): { widthPx: number; heightPx: number } {
  const spec = PAGE_SIZES[pageSize];
  const MM_TO_PX = 96 / 25.4;
  return {
    widthPx: spec.widthMm * MM_TO_PX,
    heightPx: spec.heightMm * MM_TO_PX,
  };
}

interface SourceSpanLike {
  start: number;
  end: number;
}

type RenderRole = 'heading' | 'paragraph' | 'listItem' | 'tableCell' | 'mathText' | 'code' | 'rule' | 'unknown';

interface RenderedLineAnchor {
  index: number;
  pageIndex: number;
  baselinePt: number;
  yStartPt: number;
  yEndPt: number;
  xPt: number;
  role: RenderRole;
  text: string;
  normalizedText: string;
}

interface RenderedLineGroup {
  pageIndex: number;
  baselinePt: number;
  yStartPt: number;
  yEndPt: number;
  xMinPt: number;
  sampleCount: number;
  roleScores: Record<RenderRole, number>;
  textFragments: Array<{ xPt: number; text: string }>;
}

interface RenderedLineFragment {
  pageIndex: number;
  baselinePt: number;
  yStartPt: number;
  yEndPt: number;
  xPt: number;
  role: RenderRole;
  text: string;
}

interface SourceLineDescriptor {
  lineNumber: number;
  raw: string;
  role: RenderRole | 'blank' | 'meta';
  renderable: boolean;
  normalizedText: string;
}

function normalizeSourceMapping(candidate: unknown): SourceMappingEntry[] | null {
  if (!Array.isArray(candidate)) {
    return null;
  }

  const normalized: SourceMappingEntry[] = [];
  for (const rawEntry of candidate) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as Partial<SourceMappingEntry>;
    const sourceLineStart = Number(entry.sourceLineStart);
    const sourceLineEnd = Number(entry.sourceLineEnd);
    const pageIndex = Number(entry.pageIndex);
    const yStartPt = Number(entry.yStartPt);
    const yEndPt = Number(entry.yEndPt);

    if (
      !Number.isFinite(sourceLineStart) ||
      !Number.isFinite(sourceLineEnd) ||
      !Number.isFinite(pageIndex) ||
      !Number.isFinite(yStartPt) ||
      !Number.isFinite(yEndPt)
    ) {
      continue;
    }

    normalized.push({
      sourceLineStart: Math.max(1, Math.floor(sourceLineStart)),
      sourceLineEnd: Math.max(Math.floor(sourceLineStart), Math.floor(sourceLineEnd)),
      pageIndex: Math.max(0, Math.floor(pageIndex)),
      yStartPt: Math.min(yStartPt, yEndPt),
      yEndPt: Math.max(yStartPt, yEndPt),
    });
  }

  if (normalized.length === 0) {
    return null;
  }

  normalized.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.yStartPt !== b.yStartPt) {
      return a.yStartPt - b.yStartPt;
    }
    return a.sourceLineStart - b.sourceLineStart;
  });

  return normalized;
}

function deriveSourceMappingFromSourceSpans(markdown: string, pages: PageLayout[]): SourceMappingEntry[] | null {
  if (!markdown || pages.length === 0) {
    return null;
  }

  const lineStarts = getSourceLineStarts(markdown);
  const extracted: SourceMappingEntry[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    collectSourceSpanMappingsFromOps(
      pages[pageIndex].ops,
      pageIndex,
      lineStarts,
      extracted,
    );
  }

  if (extracted.length === 0) {
    return null;
  }

  extracted.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.sourceLineStart !== b.sourceLineStart) {
      return a.sourceLineStart - b.sourceLineStart;
    }
    return a.yStartPt - b.yStartPt;
  });

  const merged: SourceMappingEntry[] = [];
  for (const entry of extracted) {
    const previous = merged.length > 0 ? merged[merged.length - 1] : null;
    if (
      previous &&
      previous.pageIndex === entry.pageIndex &&
      previous.sourceLineStart === entry.sourceLineStart &&
      previous.sourceLineEnd === entry.sourceLineEnd &&
      entry.yStartPt <= previous.yEndPt + 1.5
    ) {
      previous.yStartPt = Math.min(previous.yStartPt, entry.yStartPt);
      previous.yEndPt = Math.max(previous.yEndPt, entry.yEndPt);
      continue;
    }
    merged.push({ ...entry });
  }

  return merged.length > 0 ? merged : null;
}

function collectSourceSpanMappingsFromOps(
  ops: ReadonlyArray<DrawOp>,
  pageIndex: number,
  lineStarts: readonly number[],
  output: SourceMappingEntry[],
): void {
  for (const op of ops) {
    const sourceSpan = getSourceSpan(op);
    const yRange = getOpYRangePt(op);
    if (sourceSpan && yRange) {
      const sourceLineStart = offsetToLineNumber(sourceSpan.start, lineStarts);
      const sourceLineEnd = offsetToLineNumber(Math.max(sourceSpan.start, sourceSpan.end - 1), lineStarts);
      output.push({
        sourceLineStart,
        sourceLineEnd,
        pageIndex,
        yStartPt: yRange.yStartPt,
        yEndPt: Math.max(yRange.yEndPt, yRange.yStartPt + MIN_MAPPING_HEIGHT_PT),
      });
    }

    if (op.kind === 'textSpan') {
      collectSourceSpanMappingsFromOps(op.ops, pageIndex, lineStarts, output);
    }
  }
}

function deriveSourceMappingFromRenderedLines(markdown: string, pages: PageLayout[]): SourceMappingEntry[] {
  if (!markdown || pages.length === 0) {
    return [];
  }

  const sourceLines = describeSourceLines(markdown);
  if (sourceLines.length === 0) {
    return [];
  }

  const renderedLines = collectRenderedLineAnchors(pages);
  if (renderedLines.length === 0) {
    return buildPageDistributedMapping(sourceLines.length, pages);
  }

  const matches = matchSourceLinesToRenderedLines(sourceLines, renderedLines);
  if (matches.size === 0) {
    return buildPageDistributedMapping(sourceLines.length, pages);
  }

  return buildSourceMappingFromMatches(sourceLines, renderedLines, matches, pages);
}

function collectRenderedLineAnchors(pages: readonly PageLayout[]): RenderedLineAnchor[] {
  const groupedAnchors: RenderedLineAnchor[] = [];
  const ruleAnchors: RenderedLineAnchor[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const fragments: RenderedLineFragment[] = [];
    collectTextFragmentsFromOps(page.ops, pageIndex, 'unknown', fragments);
    ruleAnchors.push(...collectRuleAnchorsFromOps(page.ops, pageIndex, page.widthPt));

    if (fragments.length === 0) {
      continue;
    }

    fragments.sort((a, b) => {
      if (a.baselinePt !== b.baselinePt) {
        return a.baselinePt - b.baselinePt;
      }
      return a.xPt - b.xPt;
    });

    const groups: RenderedLineGroup[] = [];
    for (const fragment of fragments) {
      const previous = groups.length > 0 ? groups[groups.length - 1] : null;
      if (previous && Math.abs(fragment.baselinePt - previous.baselinePt) <= BASELINE_GROUP_TOLERANCE_PT) {
        const nextCount = previous.sampleCount + 1;
        previous.baselinePt = (previous.baselinePt * previous.sampleCount + fragment.baselinePt) / nextCount;
        previous.sampleCount = nextCount;
        previous.yStartPt = Math.min(previous.yStartPt, fragment.yStartPt);
        previous.yEndPt = Math.max(previous.yEndPt, fragment.yEndPt);
        previous.xMinPt = Math.min(previous.xMinPt, fragment.xPt);
        previous.roleScores[fragment.role] += Math.max(1, fragment.text.length);
        previous.textFragments.push({ xPt: fragment.xPt, text: fragment.text });
      } else {
        const roleScores: Record<RenderRole, number> = {
          heading: 0,
          paragraph: 0,
          listItem: 0,
          tableCell: 0,
          mathText: 0,
          code: 0,
          rule: 0,
          unknown: 0,
        };
        roleScores[fragment.role] = Math.max(1, fragment.text.length);
        groups.push({
          pageIndex: fragment.pageIndex,
          baselinePt: fragment.baselinePt,
          yStartPt: fragment.yStartPt,
          yEndPt: fragment.yEndPt,
          xMinPt: fragment.xPt,
          sampleCount: 1,
          roleScores,
          textFragments: [{ xPt: fragment.xPt, text: fragment.text }],
        });
      }
    }

    groups.sort((a, b) => {
      if (a.yStartPt !== b.yStartPt) {
        return a.yStartPt - b.yStartPt;
      }
      return a.xMinPt - b.xMinPt;
    });

    for (const group of groups) {
      const role = selectDominantRole(group.roleScores);
      const text = group.textFragments
        .slice()
        .sort((a, b) => a.xPt - b.xPt)
        .map((fragment) => fragment.text)
        .join('');
      groupedAnchors.push({
        index: -1,
        pageIndex: group.pageIndex,
        baselinePt: group.baselinePt,
        yStartPt: group.yStartPt,
        yEndPt: Math.max(group.yEndPt, group.yStartPt + MIN_MAPPING_HEIGHT_PT),
        xPt: group.xMinPt,
        role,
        text,
        normalizedText: normalizeRenderedText(text),
      });
    }
  }

  const merged = [...groupedAnchors, ...ruleAnchors];
  merged.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.yStartPt !== b.yStartPt) {
      return a.yStartPt - b.yStartPt;
    }
    return a.xPt - b.xPt;
  });

  return merged.map((anchor, index) => ({ ...anchor, index }));
}

function collectTextFragmentsFromOps(
  ops: ReadonlyArray<DrawOp>,
  pageIndex: number,
  roleHint: RenderRole,
  output: RenderedLineFragment[],
): void {
  for (const op of ops) {
    if (op.kind === 'textSpan') {
      collectTextFragmentsFromOps(op.ops, pageIndex, normalizeRenderRole(op.role), output);
      continue;
    }

    const fragment = toTextFragment(op, pageIndex, roleHint);
    if (fragment) {
      output.push(fragment);
    }
  }
}

function collectRuleAnchorsFromOps(
  ops: ReadonlyArray<DrawOp>,
  pageIndex: number,
  pageWidthPt: number,
): RenderedLineAnchor[] {
  const anchors: RenderedLineAnchor[] = [];
  for (const op of ops) {
    if (op.kind !== 'rule') {
      continue;
    }

    const isLikelyHorizontalRule = op.hPt <= 2 && op.wPt >= pageWidthPt * 0.7;
    if (!isLikelyHorizontalRule) {
      continue;
    }

    anchors.push({
      index: -1,
      pageIndex,
      baselinePt: op.yPt + op.hPt / 2,
      yStartPt: op.yPt,
      yEndPt: Math.max(op.yPt + op.hPt, op.yPt + MIN_MAPPING_HEIGHT_PT),
      xPt: op.xPt,
      role: 'rule',
      text: '',
      normalizedText: '',
    });
  }
  return anchors;
}

function toTextFragment(op: DrawOp, pageIndex: number, role: RenderRole): RenderedLineFragment | null {
  if (op.kind !== 'glyph' && op.kind !== 'glyphRun') {
    return null;
  }
  const ascentPt = op.fontSizePt * 0.85;
  const descentPt = op.fontSizePt * 0.35;
  return {
    pageIndex,
    baselinePt: op.yBaselinePt,
    yStartPt: op.yBaselinePt - ascentPt,
    yEndPt: op.yBaselinePt + descentPt,
    xPt: op.xPt,
    role,
    text: op.kind === 'glyphRun' ? op.text : op.char,
  };
}

function matchSourceLinesToRenderedLines(
  sourceLines: readonly SourceLineDescriptor[],
  renderedLines: readonly RenderedLineAnchor[],
): Map<number, number> {
  const renderableSourceLines = sourceLines.filter((line) => line.renderable);
  if (renderableSourceLines.length === 0 || renderedLines.length === 0) {
    return new Map();
  }

  const knownRoleLines = renderedLines.filter((line) => line.role !== 'unknown');
  const usableRenderedLines = knownRoleLines.length > 0 ? knownRoleLines : renderedLines;

  const matches = new Map<number, number>();
  let lastRenderedIndex = 0;

  for (let i = 0; i < renderableSourceLines.length; i += 1) {
    const sourceLine = renderableSourceLines[i];
    const expectedIndex = renderableSourceLines.length === 1
      ? 0
      : (i / (renderableSourceLines.length - 1)) * (usableRenderedLines.length - 1);

    const rawSearchStart = Math.max(
      lastRenderedIndex,
      Math.floor(expectedIndex - LINE_MATCH_SEARCH_WINDOW),
    );
    const rawSearchEnd = Math.min(
      usableRenderedLines.length - 1,
      Math.ceil(expectedIndex + LINE_MATCH_SEARCH_WINDOW),
    );
    const searchStart = Math.min(rawSearchStart, usableRenderedLines.length - 1);
    const searchEnd = Math.max(searchStart, rawSearchEnd);

    let bestIndex = clamp(Math.round(expectedIndex), searchStart, searchEnd);
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let candidateIndex = searchStart; candidateIndex <= searchEnd; candidateIndex += 1) {
      const candidate = usableRenderedLines[candidateIndex];
      const textScore = computeTextSimilarity(sourceLine.normalizedText, candidate.normalizedText);
      const roleScore = getRoleCompatibilityScore(sourceLine.role, candidate.role);
      const distancePenalty =
        Math.abs(candidateIndex - expectedIndex) / Math.max(1, usableRenderedLines.length - 1);
      const totalScore = textScore * 3 + roleScore - distancePenalty;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestIndex = candidateIndex;
      }
    }

    const chosenIndex = bestScore < MIN_LINE_MATCH_SCORE
      ? clamp(Math.round(expectedIndex), searchStart, searchEnd)
      : bestIndex;
    const chosen = usableRenderedLines[chosenIndex];
    matches.set(sourceLine.lineNumber, chosen.index);
    lastRenderedIndex = Math.max(lastRenderedIndex, chosenIndex);
  }

  return matches;
}

function buildSourceMappingFromMatches(
  sourceLines: readonly SourceLineDescriptor[],
  renderedLines: readonly RenderedLineAnchor[],
  matches: ReadonlyMap<number, number>,
  pages: readonly PageLayout[],
): SourceMappingEntry[] {
  const mapping: SourceMappingEntry[] = [];

  const previousByLine: Array<{ lineNumber: number; anchorIndex: number } | null> = new Array(sourceLines.length + 1).fill(null);
  const nextByLine: Array<{ lineNumber: number; anchorIndex: number } | null> = new Array(sourceLines.length + 1).fill(null);

  let previous: { lineNumber: number; anchorIndex: number } | null = null;
  for (let line = 1; line <= sourceLines.length; line += 1) {
    const anchorIndex = matches.get(line);
    if (anchorIndex !== undefined) {
      previous = { lineNumber: line, anchorIndex };
    }
    previousByLine[line] = previous;
  }

  let next: { lineNumber: number; anchorIndex: number } | null = null;
  for (let line = sourceLines.length; line >= 1; line -= 1) {
    const anchorIndex = matches.get(line);
    if (anchorIndex !== undefined) {
      next = { lineNumber: line, anchorIndex };
    }
    nextByLine[line] = next;
  }

  for (let line = 1; line <= sourceLines.length; line += 1) {
    const directAnchorIndex = matches.get(line);
    if (directAnchorIndex !== undefined) {
      mapping.push(createMappingEntryFromAnchor(line, renderedLines[directAnchorIndex], pages));
      continue;
    }

    const previousMatch = previousByLine[line];
    const nextMatch = nextByLine[line];

    if (previousMatch && nextMatch && previousMatch.lineNumber !== nextMatch.lineNumber) {
      const prevAnchor = renderedLines[previousMatch.anchorIndex];
      const nextAnchor = renderedLines[nextMatch.anchorIndex];
      const prevDocY = toDocumentYPt(prevAnchor, pages);
      const nextDocY = toDocumentYPt(nextAnchor, pages);
      const lineRatio = (line - previousMatch.lineNumber) / (nextMatch.lineNumber - previousMatch.lineNumber);
      const interpolatedDocY = prevDocY + (nextDocY - prevDocY) * lineRatio;
      const located = locatePageForDocumentY(interpolatedDocY, pages);
      const interpolatedHeightPt = interpolate(
        getAnchorHeightPt(prevAnchor),
        getAnchorHeightPt(nextAnchor),
        lineRatio,
      );
      mapping.push(
        createMappingEntryAtPosition(
          line,
          located.pageIndex,
          located.yOnPagePt,
          interpolatedHeightPt,
          pages,
        ),
      );
      continue;
    }

    const nearest = previousMatch ?? nextMatch;
    if (nearest) {
      mapping.push(createMappingEntryFromAnchor(line, renderedLines[nearest.anchorIndex], pages));
      continue;
    }

    return buildPageDistributedMapping(sourceLines.length, pages);
  }

  return mapping;
}

function createMappingEntryFromAnchor(
  lineNumber: number,
  anchor: RenderedLineAnchor,
  pages: readonly PageLayout[],
): SourceMappingEntry {
  return createMappingEntryAtPosition(
    lineNumber,
    anchor.pageIndex,
    anchor.yStartPt,
    getAnchorHeightPt(anchor),
    pages,
  );
}

function createMappingEntryAtPosition(
  lineNumber: number,
  pageIndex: number,
  yStartPt: number,
  heightPt: number,
  pages: readonly PageLayout[],
): SourceMappingEntry {
  const page = pages[pageIndex];
  const pageHeight = Math.max(1, page?.heightPt ?? 1);
  const clampedStart = clamp(yStartPt, 0, pageHeight);
  const desiredHeight = Math.max(MIN_MAPPING_HEIGHT_PT, heightPt);
  const clampedEnd = clamp(clampedStart + desiredHeight, 0, pageHeight);
  const yEndPt = clampedEnd > clampedStart
    ? clampedEnd
    : Math.min(pageHeight, clampedStart + MIN_MAPPING_HEIGHT_PT);

  return {
    sourceLineStart: lineNumber,
    sourceLineEnd: lineNumber,
    pageIndex,
    yStartPt: clampedStart,
    yEndPt,
  };
}

function describeSourceLines(markdown: string): SourceLineDescriptor[] {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const sourceLines: SourceLineDescriptor[] = [];

  let inCodeFence = false;
  let inDisplayMath = false;

  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i] ?? '';
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      sourceLines.push({
        lineNumber,
        raw,
        role: 'blank',
        renderable: false,
        normalizedText: '',
      });
      continue;
    }

    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      sourceLines.push({
        lineNumber,
        raw,
        role: 'meta',
        renderable: false,
        normalizedText: '',
      });
      continue;
    }

    if (inCodeFence) {
      sourceLines.push({
        lineNumber,
        raw,
        role: 'code',
        renderable: true,
        normalizedText: normalizeSourceLineText(raw, 'code'),
      });
      continue;
    }

    if (inDisplayMath) {
      const closesMath = trimmed.endsWith('$$');
      const content = closesMath ? trimmed.slice(0, Math.max(0, trimmed.length - 2)).trim() : raw;
      sourceLines.push({
        lineNumber,
        raw,
        role: content ? 'mathText' : 'meta',
        renderable: content.length > 0,
        normalizedText: content ? normalizeSourceLineText(content, 'mathText') : '',
      });
      if (closesMath) {
        inDisplayMath = false;
      }
      continue;
    }

    if (trimmed.startsWith('$$')) {
      const closesSameLine = trimmed.endsWith('$$') && trimmed.length >= 4;
      if (closesSameLine) {
        const content = trimmed.slice(2, Math.max(2, trimmed.length - 2)).trim();
        sourceLines.push({
          lineNumber,
          raw,
          role: content ? 'mathText' : 'meta',
          renderable: content.length > 0,
          normalizedText: content ? normalizeSourceLineText(content, 'mathText') : '',
        });
      } else {
        const content = trimmed.slice(2).trim();
        sourceLines.push({
          lineNumber,
          raw,
          role: content ? 'mathText' : 'meta',
          renderable: content.length > 0,
          normalizedText: content ? normalizeSourceLineText(content, 'mathText') : '',
        });
        inDisplayMath = true;
      }
      continue;
    }

    if (isTableSeparatorLine(trimmed)) {
      sourceLines.push({
        lineNumber,
        raw,
        role: 'meta',
        renderable: false,
        normalizedText: '',
      });
      continue;
    }

    const classified = classifySourceLine(raw);
    sourceLines.push({
      lineNumber,
      raw,
      role: classified.role,
      renderable: classified.renderable,
      normalizedText: classified.renderable ? normalizeSourceLineText(classified.text, classified.role) : '',
    });
  }

  return sourceLines;
}

function classifySourceLine(rawLine: string): { role: RenderRole; renderable: boolean; text: string } {
  const trimmed = rawLine.trim();

  const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    return { role: 'heading', renderable: true, text: headingMatch[2] ?? '' };
  }

  if (trimmed === '---') {
    return { role: 'rule', renderable: true, text: '' };
  }

  const listMatch = rawLine.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
  if (listMatch) {
    return { role: 'listItem', renderable: true, text: listMatch[3] ?? '' };
  }

  const blockquoteMatch = rawLine.match(/^(\s*(?:>\s*)+)(.*)$/);
  if (blockquoteMatch) {
    return { role: 'paragraph', renderable: true, text: blockquoteMatch[2] ?? '' };
  }

  if (rawLine.includes('|') && !isTableSeparatorLine(trimmed)) {
    return { role: 'tableCell', renderable: true, text: normalizeTableRowText(rawLine) };
  }

  return { role: 'paragraph', renderable: true, text: rawLine };
}

function isTableSeparatorLine(trimmedLine: string): boolean {
  if (!trimmedLine.includes('|')) {
    return false;
  }
  const cells = trimmedLine
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  if (cells.length === 0) {
    return false;
  }
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeTableRowText(row: string): string {
  return row
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .join(' ');
}

function normalizeSourceLineText(text: string, role: RenderRole): string {
  const roleAwareText = role === 'tableCell' ? normalizeTableRowText(text) : text;
  return roleAwareText
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeRenderedText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeRenderRole(role: string): RenderRole {
  if (
    role === 'heading' ||
    role === 'paragraph' ||
    role === 'listItem' ||
    role === 'tableCell' ||
    role === 'mathText' ||
    role === 'code'
  ) {
    return role;
  }
  return 'unknown';
}

function selectDominantRole(scores: Record<RenderRole, number>): RenderRole {
  let bestRole: RenderRole = 'unknown';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const role of Object.keys(scores) as RenderRole[]) {
    const score = scores[role];
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }
  return bestRole;
}

function getRoleCompatibilityScore(sourceRole: SourceLineDescriptor['role'], renderedRole: RenderRole): number {
  if (sourceRole === renderedRole) {
    return 1.2;
  }
  if (sourceRole === 'paragraph' && renderedRole === 'heading') {
    return 0.2;
  }
  if (sourceRole === 'paragraph' && renderedRole === 'listItem') {
    return 0.15;
  }
  if (sourceRole === 'tableCell' && renderedRole === 'paragraph') {
    return 0.1;
  }
  if (sourceRole === 'rule' && renderedRole === 'unknown') {
    return 0.1;
  }
  if (sourceRole === 'blank' || sourceRole === 'meta') {
    return -0.2;
  }
  if (renderedRole === 'unknown') {
    return 0;
  }
  return -0.35;
}

function computeTextSimilarity(sourceText: string, renderedText: string): number {
  const source = sourceText.trim();
  const rendered = renderedText.trim();
  if (!source || !rendered) {
    return 0;
  }
  if (source === rendered) {
    return 1;
  }

  const sourceTokens = source.split(/\s+/).filter(Boolean);
  const renderedTokens = rendered.split(/\s+/).filter(Boolean);
  const tokenDice = diceCoefficient(sourceTokens, renderedTokens);

  const sourceBigrams = buildBigrams(source);
  const renderedBigrams = buildBigrams(rendered);
  const bigramDice = diceCoefficient(sourceBigrams, renderedBigrams);

  let substringScore = 0;
  if (source.includes(rendered) || rendered.includes(source)) {
    substringScore = Math.min(source.length, rendered.length) / Math.max(source.length, rendered.length);
  }

  return Math.max(tokenDice, bigramDice, substringScore * 0.9);
}

function buildBigrams(text: string): string[] {
  if (text.length < 2) {
    return text.length === 0 ? [] : [text];
  }
  const bigrams: string[] = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    bigrams.push(text.slice(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const counts = new Map<string, number>();
  for (const token of a) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let intersection = 0;
  for (const token of b) {
    const count = counts.get(token) ?? 0;
    if (count > 0) {
      intersection += 1;
      counts.set(token, count - 1);
    }
  }
  return (2 * intersection) / (a.length + b.length);
}

function toDocumentYPt(anchor: RenderedLineAnchor, pages: readonly PageLayout[]): number {
  let yPt = anchor.yStartPt;
  for (let i = 0; i < anchor.pageIndex && i < pages.length; i += 1) {
    yPt += pages[i].heightPt;
  }
  return yPt;
}

function getAnchorHeightPt(anchor: RenderedLineAnchor): number {
  return Math.max(MIN_MAPPING_HEIGHT_PT, anchor.yEndPt - anchor.yStartPt);
}

function interpolate(from: number, to: number, ratio: number): number {
  return from + ((to - from) * ratio);
}

function buildPageDistributedMapping(sourceLineCount: number, pages: readonly PageLayout[]): SourceMappingEntry[] {
  if (sourceLineCount <= 0 || pages.length === 0) {
    return [];
  }

  const totalHeight = pages.reduce((sum, page) => sum + Math.max(1, page.heightPt), 0);
  const mapping: SourceMappingEntry[] = [];

  for (let sourceLine = 1; sourceLine <= sourceLineCount; sourceLine += 1) {
    const ratio = sourceLineCount === 1 ? 0 : (sourceLine - 1) / (sourceLineCount - 1);
    const targetYPt = ratio * Math.max(0, totalHeight - MIN_MAPPING_HEIGHT_PT);
    const located = locatePageForDocumentY(targetYPt, pages);
    const perPageLineEstimate = Math.max(1, Math.ceil(sourceLineCount / pages.length));
    const lineHeightPt = Math.max(8, located.page.heightPt / perPageLineEstimate);
    mapping.push({
      sourceLineStart: sourceLine,
      sourceLineEnd: sourceLine,
      pageIndex: located.pageIndex,
      yStartPt: located.yOnPagePt,
      yEndPt: clamp(located.yOnPagePt + lineHeightPt, 0, located.page.heightPt),
    });
  }

  return mapping;
}

function locatePageForDocumentY(
  yPt: number,
  pages: readonly PageLayout[],
): { pageIndex: number; page: PageLayout; yOnPagePt: number } {
  let remaining = Math.max(0, yPt);
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const pageHeight = Math.max(1, page.heightPt);
    if (remaining <= pageHeight || i === pages.length - 1) {
      return {
        pageIndex: i,
        page,
        yOnPagePt: clamp(remaining, 0, pageHeight),
      };
    }
    remaining -= pageHeight;
  }

  const lastPage = pages[pages.length - 1];
  return {
    pageIndex: pages.length - 1,
    page: lastPage,
    yOnPagePt: clamp(lastPage.heightPt, 0, lastPage.heightPt),
  };
}

function getSourceSpan(op: DrawOp): SourceSpanLike | null {
  if (!('sourceSpan' in op)) {
    return null;
  }

  const raw = (op as { sourceSpan?: unknown }).sourceSpan;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const start = Number((raw as { start?: unknown }).start);
  const end = Number((raw as { end?: unknown }).end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const normalizedStart = Math.max(0, Math.floor(start));
  const normalizedEnd = Math.max(normalizedStart, Math.floor(end));
  return { start: normalizedStart, end: normalizedEnd };
}

function getOpYRangePt(op: DrawOp): { yStartPt: number; yEndPt: number } | null {
  switch (op.kind) {
    case 'glyph':
    case 'glyphRun': {
      const ascentPt = op.fontSizePt * 0.85;
      const descentPt = op.fontSizePt * 0.35;
      return {
        yStartPt: op.yBaselinePt - ascentPt,
        yEndPt: op.yBaselinePt + descentPt,
      };
    }
    case 'textSpan': {
      let yStartPt = Number.POSITIVE_INFINITY;
      let yEndPt = Number.NEGATIVE_INFINITY;
      for (const child of op.ops) {
        const childRange = getOpYRangePt(child);
        if (!childRange) {
          continue;
        }
        yStartPt = Math.min(yStartPt, childRange.yStartPt);
        yEndPt = Math.max(yEndPt, childRange.yEndPt);
      }
      if (!Number.isFinite(yStartPt) || !Number.isFinite(yEndPt)) {
        return null;
      }
      return { yStartPt, yEndPt };
    }
    case 'link':
      return {
        yStartPt: op.yPt,
        yEndPt: op.yPt + op.hPt,
      };
    case 'underline':
    case 'strikethrough':
      return {
        yStartPt: op.yPt - op.thicknessPt / 2,
        yEndPt: op.yPt + op.thicknessPt / 2,
      };
    default:
      return null;
  }
}

function getSourceLineStarts(source: string): number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '\r') {
      if (source[i + 1] === '\n') {
        lineStarts.push(i + 2);
        i += 1;
      } else {
        lineStarts.push(i + 1);
      }
      continue;
    }
    if (char === '\n') {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

function offsetToLineNumber(offset: number, lineStarts: readonly number[]): number {
  if (lineStarts.length === 0) {
    return 1;
  }

  let low = 0;
  let high = lineStarts.length - 1;
  let best = 0;
  const targetOffset = Math.max(0, Math.floor(offset));

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midOffset = lineStarts[mid];
    if (midOffset <= targetOffset) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function loadOptionalEmojiFallbackFonts(): Promise<FontSpec[]> {
  if (!EMOJI_FALLBACK_FONT_FETCH_ENABLED) {
    return [];
  }

  const fallbackSpecs = EMOJI_FONT_PROFILE === 'full'
    ? EMOJI_FALLBACKS_FULL
    : EMOJI_FALLBACKS_COMPACT;

  const loaded = await Promise.all(
    fallbackSpecs.map(({ id, url, cssFamily }) => loadOptionalFontSpecFromUrl(id, url, cssFamily)),
  );
  return loaded.filter((font): font is FontSpec => font !== null);
}

async function loadOptionalFontSpecFromUrl(
  id: string,
  url: string,
  cssFamily: string,
): Promise<FontSpec | null> {
  try {
    return await loadFontSpecFromUrl(id, url, cssFamily);
  } catch {
    return null;
  }
}

function buildConfigSignature(config: TypesetterConfig): string {
  return JSON.stringify({
    pageSize: config.pageSize,
    marginMm: config.marginMm,
    fontSizePt: config.fontSizePt,
    headerFooter: config.headerFooter ?? null,
    emojiMode: config.emojiMode ?? 'preserve',
  });
}

/**
 * Export types for use elsewhere.
 */
export type { PageLayout, CanvasViewOptions, PdfOptions, HeaderFooterConfig };

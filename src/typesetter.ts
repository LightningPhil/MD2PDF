/**
 * Typesetter module - bridges the integrated typesetter engine to the MD2PDF application.
 * This provides canvas-based rendering and client-side PDF export.
 */
import {
  createTypesetter,
  loadFontSpecFromUrl,
  mmToPt,
  type Typesetter,
  type FontSpec,
  type PageLayout,
  type TypesetOptions,
  type CanvasViewOptions,
  type PdfOptions,
  type HeaderFooterConfig,
} from './typesetter-engine/index.js';
import {
  normalizeSourceMapping,
  deriveSourceMappingFromSourceSpans,
  type SourceMappingEntry,
} from './source-mapping/index.js';

export type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';
export type EmojiMode = 'preserve' | 'suppress';

export interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
}

export type { SourceMappingEntry };

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
  const result = await typesetter.typeset(markdown);

  // The typesetter now emits sourceMapping directly from the layout phase.
  // Normalize it to ensure consistent shape; fallback to sourceSpan derivation if not provided.
  let sourceMapping = normalizeSourceMapping(result.sourceMapping);

  // If the typesetter didn't emit a mapping (shouldn't happen), fall back to sourceSpan derivation.
  if (!sourceMapping || sourceMapping.length === 0) {
    sourceMapping = deriveSourceMappingFromSourceSpans(markdown, result.pages);
  }

  return {
    pages: result.pages,
    diagnostics: result.diagnostics,
    sourceMapping: sourceMapping ?? undefined,
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


// Source mapping code has been extracted to ./source-mapping/resolver.ts

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
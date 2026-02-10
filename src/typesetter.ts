/**
 * Typesetter module - bridges the canvadoc-typesetter to the MD2PDF application.
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
} from 'canvadoc-typesetter';

export type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';

export interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
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
}

interface TypesetterConfig {
  pageSize: PageSizeKey;
  marginMm: number;
  fontSizePt: number;
}

let fontsLoaded = false;
let loadedFonts: FontSet | null = null;
let typesetterInstance: Typesetter | null = null;
let currentConfig: TypesetterConfig | null = null;

/**
 * Load all required fonts. Call this once during app initialization.
 */
export async function loadFonts(): Promise<FontSet> {
  if (fontsLoaded && loadedFonts) {
    return loadedFonts;
  }

  const [textFont, textBold, textItalic, textBoldItalic, mathFont, monoFont] = await Promise.all([
    loadFontSpecFromUrl('source-serif', '/fonts/SourceSerif4-Regular.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-bold', '/fonts/SourceSerif4-Bold.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-italic', '/fonts/SourceSerif4-Italic.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('source-serif-bold-italic', '/fonts/SourceSerif4-BoldItalic.otf', 'Source Serif 4'),
    loadFontSpecFromUrl('stix-math', '/fonts/STIXTwoMath-Regular.otf', 'STIX Two Math'),
    loadFontSpecFromUrl('ibm-plex-mono', '/fonts/IBMPlexMono-Regular.otf', 'IBM Plex Mono'),
  ]);

  loadedFonts = {
    text: textFont,
    textBold: textBold,
    textItalic: textItalic,
    textBoldItalic: textBoldItalic,
    math: mathFont,
    mono: monoFont,
  };

  fontsLoaded = true;
  return loadedFonts;
}

/**
 * Get or create a typesetter instance with the given configuration.
 */
export async function getTypesetter(config: TypesetterConfig): Promise<Typesetter> {
  const fonts = await loadFonts();

  // Check if we can reuse existing typesetter
  if (
    typesetterInstance &&
    currentConfig &&
    currentConfig.pageSize === config.pageSize &&
    currentConfig.marginMm === config.marginMm &&
    currentConfig.fontSizePt === config.fontSizePt
  ) {
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
    fonts: {
      text: fonts.text,
      textBold: fonts.textBold,
      textItalic: fonts.textItalic,
      textBoldItalic: fonts.textBoldItalic,
      math: fonts.math,
      mono: fonts.mono,
    },
  };

  typesetterInstance = createTypesetter(options);
  currentConfig = { ...config };

  return typesetterInstance;
}

/**
 * Typeset markdown content and return the page layouts.
 */
export async function typesetMarkdown(
  markdown: string,
  config: TypesetterConfig
): Promise<{ pages: PageLayout[]; diagnostics: { warnings: string[]; errors: string[] } }> {
  const typesetter = await getTypesetter(config);
  return typesetter.typeset(markdown);
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

/**
 * Export types for use elsewhere.
 */
export type { PageLayout, CanvasViewOptions, PdfOptions };

/**
 * CanvaDoc Typesetter
 *
 * A deterministic markdown-to-PDF typesetter that renders the same content
 * identically to both HTML Canvas and PDF.
 *
 * @packageDocumentation
 */

import { FontMetricsProvider } from "./font-metrics";
import { layoutDocument } from "./layout/engine";
import { createDefaultOptions, normalizeOptions } from "./options";
import { renderPagesToCanvas } from "./renderers/canvas";
import { renderPagesToPdf } from "./renderers/pdf";
import type {
  CanvasViewOptions,
  FontSpec,
  PageLayout,
  PdfOptions,
  TypesetOptions,
  TypesetResult,
  Typesetter
} from "./types";

const DEFAULT_VIEW: CanvasViewOptions = {
  zoom: 1,
  pageGapPt: 20,
  background: "white",
  mode: "stackedPages"
};

/**
 * Create a new typesetter instance with the given options.
 *
 * @param options - Typesetting configuration (page size, fonts, typography)
 * @returns Typesetter instance with typeset, renderToCanvas, and renderToPdf methods
 *
 * @example
 * ```typescript
 * const typesetter = createTypesetter({
 *   page: { size: "A4", marginPt: { top: 72, right: 72, bottom: 72, left: 72 } },
 *   typography: { baseFontSizePt: 12, lineHeight: 1.4, paragraphSpacingPt: 12, headingScale: { h1: 2, h2: 1.5, h3: 1.2 } },
 *   fonts: { text: textFont, math: mathFont, mono: monoFont }
 * });
 *
 * const { pages, diagnostics } = await typesetter.typeset("# Hello World\n\nSome content.");
 * typesetter.renderToCanvas(pages, canvasElement, { zoom: 1.5 });
 * const pdfBytes = await typesetter.renderToPdf(pages, { title: "My Document" });
 * ```
 */
export function createTypesetter(options: TypesetOptions): Typesetter {
  const mergedOptions = createDefaultOptions(options);
  const normalized = normalizeOptions(mergedOptions);
  const fontSpecs: FontSpec[] = [normalized.fonts.text, normalized.fonts.math];
  if (normalized.fonts.textBold) {
    fontSpecs.push(normalized.fonts.textBold);
  }
  if (normalized.fonts.textItalic) {
    fontSpecs.push(normalized.fonts.textItalic);
  }
  if (normalized.fonts.textBoldItalic) {
    fontSpecs.push(normalized.fonts.textBoldItalic);
  }
  if (normalized.fonts.mono) {
    fontSpecs.push(normalized.fonts.mono);
  }
  if (normalized.fonts.fallback?.length) {
    fontSpecs.push(...normalized.fonts.fallback);
  }
  const metrics = new FontMetricsProvider(fontSpecs);

  return {
    async typeset(markdown: string): Promise<TypesetResult> {
      await metrics.ensureCanvasFontsLoaded();
      return layoutDocument(markdown, normalized, metrics);
    },

    renderToCanvas(
      pages: PageLayout[],
      canvas: HTMLCanvasElement,
      view: CanvasViewOptions
    ): void {
      renderPagesToCanvas(pages, canvas, { ...DEFAULT_VIEW, ...view }, metrics);
    },

    async renderToPdf(
      pages: PageLayout[],
      pdfOptions?: PdfOptions
    ): Promise<Uint8Array> {
      return renderPagesToPdf(pages, metrics, pdfOptions);
    }
  };
}

/**
 * Load a font specification from a URL.
 *
 * @param id - Unique identifier for the font
 * @param url - URL to fetch the font file from
 * @param cssFamily - Optional CSS font-family name for canvas rendering
 * @returns Promise resolving to a FontSpec object
 *
 * @example
 * ```typescript
 * const textFont = await loadFontSpecFromUrl("libertinus", "/fonts/LibertinusSerif-Regular.otf", "Libertinus Serif");
 * const mathFont = await loadFontSpecFromUrl("stix", "/fonts/STIXTwoMath-Regular.otf", "STIX Two Math");
 * ```
 */
export async function loadFontSpecFromUrl(
  id: string,
  url: string,
  cssFamily?: string
): Promise<{ id: string; source: ArrayBuffer; cssFamily?: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font ${url}: ${response.status} ${response.statusText}`);
  }
  return {
    id,
    source: await response.arrayBuffer(),
    cssFamily
  };
}

// Re-export all types
export * from "./types";

/**
 * Convert millimeters to points.
 * @param mm - Value in millimeters
 * @returns Value in points (1pt = 1/72 inch)
 */
export { mmToPt } from "./options";

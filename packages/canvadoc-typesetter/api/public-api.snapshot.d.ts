/**
 * CanvaDoc Typesetter
 *
 * A deterministic markdown-to-PDF typesetter that renders the same content
 * identically to both HTML Canvas and PDF.
 *
 * @packageDocumentation
 */
import type { CanvasViewOptions, DrawOp, FontSpec, HeaderFooterConfig, MarginConfig, MarginPt, MarginPreset, PageLayout, PageSize, PageSizePreset, PdfOptions, SourceSpan, TypesetDiagnostics, TypesetFeatureOptions, TypesetOptions, TypesetResult, Typesetter, TypesetterCapabilities, TypesetterRuntimeMetadata } from "./types";
/**
 * Package version exposed for consumer capability checks.
 */
export declare const CANVADOC_TYPESETTER_VERSION = "0.1.0";
/**
 * Stable runtime capability flags for integration-time feature detection.
 */
export declare const CANVADOC_TYPESETTER_CAPABILITIES: TypesetterCapabilities;
/**
 * Runtime metadata bundle for consumer compatibility checks.
 */
export declare const CANVADOC_TYPESETTER_METADATA: TypesetterRuntimeMetadata;
/**
 * Create a new typesetter instance with the given options.
 *
 * @param options - Typesetting configuration (page size, fonts, typography)
 * @returns Typesetter instance with typeset, renderToCanvas, and renderToPdf methods
 *
 * @example
 * ```typescript
 * const typesetter = createTypesetter({
 *   page: { size: "A4", margin: { top: 72, right: 72, bottom: 72, left: 72 } },
 *   typography: { baseFontSizePt: 12, lineHeight: 1.4, paragraphSpacingPt: 12, headingScale: { h1: 2, h2: 1.5, h3: 1.2 } },
 *   fonts: { text: textFont, math: mathFont, mono: monoFont }
 * });
 *
 * const { pages, diagnostics } = await typesetter.typeset("# Hello World\n\nSome content.");
 * typesetter.renderToCanvas(pages, canvasElement, { zoom: 1.5 });
 * const pdfBytes = await typesetter.renderToPdf(pages, { title: "My Document" });
 * ```
 */
export declare function createTypesetter(options: TypesetOptions): Typesetter;
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
export declare function loadFontSpecFromUrl(id: string, url: string, cssFamily?: string): Promise<FontSpec>;
/**
 * Read the package runtime metadata.
 */
export declare function getCanvaDocTypesetterMetadata(): TypesetterRuntimeMetadata;
export type { CanvasViewOptions, DrawOp, FontSpec, HeaderFooterConfig, MarginConfig, MarginPt, MarginPreset, PageLayout, PageSize, PageSizePreset, PdfOptions, SourceSpan, TypesetDiagnostics, TypesetFeatureOptions, TypesetOptions, TypesetResult, Typesetter, TypesetterCapabilities, TypesetterRuntimeMetadata };
/**
 * Convert millimeters to points.
 * @param mm - Value in millimeters
 * @returns Value in points (1pt = 1/72 inch)
 */
export { mmToPt } from "./options";
//# sourceMappingURL=index.d.ts.map

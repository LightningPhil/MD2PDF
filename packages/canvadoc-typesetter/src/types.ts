/**
 * Preset page size names.
 * These correspond to standard paper sizes.
 */
export type PageSizePreset = "A5" | "A4" | "A3" | "Letter" | "Legal" | "Tabloid";

/**
 * Custom page dimensions in points (1pt = 1/72 inch).
 */
export type CustomPageSize = { widthPt: number; heightPt: number };

/**
 * Supported page sizes for typeset documents.
 * Use a preset name or specify custom dimensions.
 */
export type PageSize = PageSizePreset | CustomPageSize;

/**
 * Preset margin widths.
 * - Narrow: ~12.7mm (0.5in)
 * - Medium: ~25.4mm (1in) - default
 * - Wide: ~50.8mm (2in)
 */
export type MarginPreset = "Narrow" | "Medium" | "Wide";

/**
 * Page margins in points (1pt = 1/72 inch).
 */
export type MarginPt = {
  /** Top margin in points */
  top: number;
  /** Right margin in points */
  right: number;
  /** Bottom margin in points */
  bottom: number;
  /** Left margin in points */
  left: number;
};

/**
 * Margin configuration - can be a preset name or custom values.
 */
export type MarginConfig = MarginPreset | MarginPt;

/**
 * Header/Footer content configuration.
 * Content is parsed as simple markdown (text only, no block elements).
 * 
 * Supported placeholders:
 * - {{pageNumber}} - Current page number (1-based)
 * - {{totalPages}} - Total number of pages
 * - {{date}} - Current date in ISO format (YYYY-MM-DD)
 * - {{date:FORMAT}} - Date with custom format (e.g., {{date:DD/MM/YYYY}})
 * 
 * @example
 * ```typescript
 * header: {
 *   left: "My Document",
 *   center: "",
 *   right: "{{date}}"
 * }
 * footer: {
 *   left: "",
 *   center: "Page {{pageNumber}} of {{totalPages}}",
 *   right: ""
 * }
 * ```
 */
export type HeaderFooterContent = {
  /** Left-aligned content */
  left?: string;
  /** Center-aligned content */
  center?: string;
  /** Right-aligned content */
  right?: string;
};

/**
 * Header and footer configuration for the document.
 */
export type HeaderFooterConfig = {
  /** Header content (appears at top of each page within margins) */
  header?: HeaderFooterContent;
  /** Footer content (appears at bottom of each page within margins) */
  footer?: HeaderFooterContent;
  /** Font size for header/footer text in points. Default: 10 */
  fontSizePt?: number;
  /** Skip header/footer on first page. Default: false */
  skipFirstPage?: boolean;
  /** Include a separator line between header/footer and content. Default: false */
  showSeparator?: boolean;
};

/**
 * Font specification for loading and registering fonts.
 */
export type FontSpec = {
  /** Unique identifier for the font */
  id: string;
  /** Font file as ArrayBuffer (typically loaded via fetch) */
  source: ArrayBuffer;
  /** CSS font-family name for canvas rendering */
  cssFamily?: string;
};

/**
 * Feature options for controlling typesetting behavior.
 * All features are optional and have sensible defaults.
 */
export type TypesetFeatureOptions = {
  /** Enable table rendering. Default: true */
  tables?: boolean;
  /** Code block rendering options */
  codeBlocks?: {
    /** Add background color to code blocks. Default: true */
    background?: boolean;
    /** Add border around code blocks. Default: true */
    border?: boolean;
    /** Show line numbers. Default: false */
    lineNumbers?: boolean;
    /** Wrap long lines instead of clipping. Default: true */
    wrapLongLines?: boolean;
    /** Padding inside code blocks in points. Default: 8 */
    paddingPt?: number;
    /** Number of spaces per tab. Default: 4 */
    tabSize?: number;
  };
  /** Math rendering options */
  math?: {
    /** Enable math environments (aligned, matrix, cases, etc.). Default: true */
    environments?: boolean;
    /** Delimiter scaling mode: "scale", "assemble", or "off". Default: "scale" */
    stretchyDelimiters?: "scale" | "assemble" | "off";
    /** Enable accent marks in math. Default: true */
    accents?: boolean;
    /** Enable big operators (sum, integral, etc.). Default: true */
    bigOperators?: boolean;
    /** Draw math debug overlays (boxes/baselines/guides). Default: false */
    debugOverlays?: boolean;
  };
  /** Typography and line-breaking options */
  typography?: {
    /** Enable deterministic hyphenation. Default: false */
    hyphenation?: boolean;
    /** Enable deterministic justification. Default: false */
    justification?: boolean;
    /** Enable widow/orphan heuristics. Default: true */
    widowOrphanControl?: boolean;
    /** Minimum chars before hyphen break point. Default: 3 */
    hyphenMinPrefix?: number;
    /** Minimum chars after hyphen break point. Default: 3 */
    hyphenMinSuffix?: number;
    /** Minimum fill ratio before applying justification. Default: 0.8 */
    justifyMinLineFill?: number;
    /** Draw underlines for links. Default: false */
    linkUnderline?: boolean;
    /** Link underline placement strategy. Default: "smart" */
    linkUnderlineMode?: "fontMetrics" | "smart";
    /** Minimum underline offset below baseline in em when using smart mode. Default: 0.11 */
    linkUnderlineMinOffsetEm?: number;
    /** Maximum underline thickness in em when using smart mode. Default: 0.06 */
    linkUnderlineMaxThicknessEm?: number;
    /** Draw baseline/decoration debug guides. Default: false */
    debugDecorations?: boolean;
  };
};

/**
 * Internal normalized feature options with all defaults applied.
 * @internal
 */
export type NormalizedTypesetFeatures = {
  tables: boolean;
  codeBlocks: {
    background: boolean;
    border: boolean;
    lineNumbers: boolean;
    wrapLongLines: boolean;
    paddingPt: number;
    tabSize: number;
  };
  math: {
    environments: boolean;
    stretchyDelimiters: "scale" | "assemble" | "off";
    accents: boolean;
    bigOperators: boolean;
    debugOverlays: boolean;
  };
  typography: {
    hyphenation: boolean;
    justification: boolean;
    widowOrphanControl: boolean;
    hyphenMinPrefix: number;
    hyphenMinSuffix: number;
    justifyMinLineFill: number;
    linkUnderline: boolean;
    linkUnderlineMode: "fontMetrics" | "smart";
    linkUnderlineMinOffsetEm: number;
    linkUnderlineMaxThicknessEm: number;
    debugDecorations: boolean;
  };
};

/**
 * Main typesetting options for configuring document layout.
 *
 * @example
 * ```typescript
 * const options: TypesetOptions = {
 *   page: {
 *     size: "A4",
 *     marginPt: { top: 72, right: 72, bottom: 72, left: 72 }
 *   },
 *   typography: {
 *     baseFontSizePt: 12,
 *     lineHeight: 1.4,
 *     paragraphSpacingPt: 12,
 *     headingScale: { h1: 2.0, h2: 1.5, h3: 1.2 }
 *   },
 *   fonts: {
 *     text: textFontSpec,
 *     math: mathFontSpec,
 *     mono: monoFontSpec
 *   }
 * };
 * ```
 */
export type TypesetOptions = {
  /** Page layout configuration */
  page: {
    /** Page size - preset name or custom dimensions */
    size: PageSize;
    /** Page margins - preset name or custom values in points */
    margin: MarginConfig;
  };
  /** Header and footer configuration */
  headerFooter?: HeaderFooterConfig;
  /** Typography settings */
  typography: {
    /** Base font size in points. Default: 12 */
    baseFontSizePt: number;
    /** Line height multiplier. Default: 1.4 */
    lineHeight: number;
    /** Spacing between paragraphs in points. Default: 12 */
    paragraphSpacingPt: number;
    /** Scale factors for heading levels */
    headingScale: { h1: number; h2: number; h3: number };
  };
  /** Font specifications */
  fonts: {
    /** Primary text font */
    text: FontSpec;
    /** Optional bold text font variant */
    textBold?: FontSpec;
    /** Optional italic text font variant */
    textItalic?: FontSpec;
    /** Optional bold italic text font variant */
    textBoldItalic?: FontSpec;
    /** Monospace font for code blocks */
    mono?: FontSpec;
    /** Math font (should contain math symbols) */
    math: FontSpec;
    /** Ordered deterministic fallback fonts used when glyphs are missing */
    fallback?: FontSpec[];
  };
  features?: TypesetFeatureOptions;
};

/**
 * Options for rendering pages to a canvas element.
 */
export type CanvasViewOptions = {
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Gap between pages in points when rendering multiple pages */
  pageGapPt: number;
  /** Background color for the canvas */
  background: "white" | "transparent";
  /** Rendering mode: stack pages vertically or show single page */
  mode: "stackedPages" | "singlePage";
  /** Page index to display when mode is "singlePage" */
  pageIndex?: number;
};

/**
 * Options for PDF generation.
 */
export type PdfOptions = {
  /** PDF document title (metadata) */
  title?: string;
  /** PDF document author (metadata) */
  author?: string;
  /** PDF subject metadata */
  subject?: string;
  /** PDF keyword metadata */
  keywords?: string[];
  /** Use object stream compression. Default: true */
  compress?: boolean;
};

/**
 * Diagnostic information from the typesetting process.
 */
export type TypesetDiagnostics = {
  /** Warning messages (non-fatal issues) */
  warnings: string[];
  /** Error messages (may affect output quality) */
  errors: string[];
  /** Performance timing information in milliseconds */
  timingsMs?: Record<string, number>;
};

/**
 * Entry mapping a source line range to a rendered position.
 * Used for bidirectional scroll sync between editor and canvas.
 */
export type SourceMappingEntry = {
  /** First source line (1-based) */
  sourceLineStart: number;
  /** Last source line (1-based, inclusive) */
  sourceLineEnd: number;
  /** Zero-based page index where the block starts */
  pageIndex: number;
  /** Y position in points from top of page where block starts */
  yStartPt: number;
  /** Y position in points from top of page where block ends */
  yEndPt: number;
};

/**
 * Result of the typesetting process.
 */
export type TypesetResult = {
  /** Array of laid out pages */
  pages: PageLayout[];
  /** Diagnostic information (warnings, errors, timings) */
  diagnostics: TypesetDiagnostics;
  /** Source line to rendered position mapping for scroll sync */
  sourceMapping?: SourceMappingEntry[];
};

/**
 * Layout information for a single page.
 */
export type PageLayout = {
  /** Zero-based page index */
  index: number;
  /** Page width in points */
  widthPt: number;
  /** Page height in points */
  heightPt: number;
  /** Drawing operations for this page */
  ops: DrawOp[];
};

/**
 * Drawing operation for a single glyph.
 * Used for positioning individual characters with precise control.
 */
export type GlyphOp = {
  kind: "glyph";
  /** Font identifier */
  fontId: string;
  /** Font size in points */
  fontSizePt: number;
  /** X position in points */
  xPt: number;
  /** Y position (baseline) in points */
  yBaselinePt: number;
  /** Character to render */
  char: string;
  /** Optional source mapping for debugging */
  sourceSpan?: SourceSpan;
};

/**
 * Source span for mapping rendered content back to source.
 * Useful for editor integration and debugging.
 */
export type SourceSpan = {
  /** Start offset in source text */
  start: number;
  /** End offset in source text */
  end: number;
  /** Source type (markdown or math) */
  kind: "markdown" | "math";
};

/**
 * Drawing operation for a run of glyphs (batched text).
 * More efficient than multiple GlyphOp for sequential text.
 */
export type GlyphRunOp = {
  kind: "glyphRun";
  /** Font identifier */
  fontId: string;
  /** Font size in points */
  fontSizePt: number;
  /** X position in points (start of run) */
  xPt: number;
  /** Y position (baseline) in points */
  yBaselinePt: number;
  /** Text content */
  text: string;
  /** Optional per-character x offsets for kerning/positioning */
  xOffsetsPt?: number[];
  /** Optional source mapping for debugging */
  sourceSpan?: SourceSpan;
};

/**
 * Semantic grouping wrapper for text operations.
 * Geometry is defined by child ops; this wrapper provides logical grouping.
 */
export type TextSpanOp = {
  kind: "textSpan";
  /** Stable span id for downstream tooling */
  id: string;
  /** Semantic role for extraction/debugging */
  role: "paragraph" | "heading" | "listItem" | "tableCell" | "mathText" | "code";
  /** Child text operations to paint in order */
  ops: Array<GlyphOp | GlyphRunOp>;
  /** Optional source mapping */
  sourceSpan?: SourceSpan;
};

/**
 * Link rectangle for PDF annotations.
 * Canvas can ignore it or use it for debug/hover overlays.
 */
export type LinkOp = {
  kind: "link";
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  href: string;
  sourceSpan?: SourceSpan;
};

/**
 * Underline decoration operation.
 * Coordinates are in page space with y-down orientation.
 */
export type UnderlineOp = {
  kind: "underline";
  xPt: number;
  yPt: number;
  wPt: number;
  thicknessPt: number;
  colorRgb?: [number, number, number];
  sourceSpan?: SourceSpan;
};

/**
 * Strikethrough decoration operation.
 * Coordinates are in page space with y-down orientation.
 */
export type StrikethroughOp = {
  kind: "strikethrough";
  xPt: number;
  yPt: number;
  wPt: number;
  thicknessPt: number;
  colorRgb?: [number, number, number];
  sourceSpan?: SourceSpan;
};

/**
 * Drawing operation for a filled rectangle (rule).
 * Used for fraction bars, table borders, and other geometric fills.
 */
export type RuleOp = {
  kind: "rule";
  /** X position in points */
  xPt: number;
  /** Y position in points */
  yPt: number;
  /** Width in points */
  wPt: number;
  /** Height in points */
  hPt: number;
  /** Optional RGB color (0-1 per channel). Default: black */
  colorRgb?: [number, number, number];
  /**
   * Optional semantic hint used by renderers for operation-specific treatment.
   * Omitted for generic rules.
   */
  role?: "sqrtOverbar";
};

/**
 * Debug drawing operation for visualizing bounding boxes.
 * @internal Only used during development/debugging.
 */
export type DebugBoxOp = {
  kind: "debugBox";
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  label?: string;
};

/**
 * Union type of all drawing operations.
 * Renderers must handle all operation types.
 */
export type DrawOp =
  | GlyphOp
  | GlyphRunOp
  | TextSpanOp
  | LinkOp
  | UnderlineOp
  | StrikethroughOp
  | RuleOp
  | DebugBoxOp;

/**
 * Main typesetter interface for processing markdown into pages.
 *
 * @example
 * ```typescript
 * const typesetter = createTypesetter(options);
 * const result = await typesetter.typeset(markdown);
 * typesetter.renderToCanvas(result.pages, canvas, { zoom: 1 });
 * const pdf = await typesetter.renderToPdf(result.pages);
 * ```
 */
export interface Typesetter {
  /**
   * Typeset markdown content into paginated layout.
   * @param markdown - Markdown source text
   * @returns Promise resolving to pages and diagnostics
   */
  typeset(markdown: string): Promise<TypesetResult>;

  /**
   * Render pages to an HTML canvas element.
   * @param pages - Pages from typeset result
   * @param canvas - Target canvas element
   * @param view - View options (zoom, background, etc.)
   */
  renderToCanvas(
    pages: PageLayout[],
    canvas: HTMLCanvasElement,
    view: CanvasViewOptions
  ): void;

  /**
   * Render pages to a PDF document.
   * @param pages - Pages from typeset result
   * @param pdfOptions - Optional PDF metadata
   * @returns Promise resolving to PDF bytes
   */
  renderToPdf(pages: PageLayout[], pdfOptions?: PdfOptions): Promise<Uint8Array>;
}

/**
 * Resolved page dimensions with computed content area.
 * @internal
 */
export type ResolvedPage = {
  widthPt: number;
  heightPt: number;
  marginPt: MarginPt;
  contentXPt: number;
  contentYPt: number;
  contentWPt: number;
  contentHPt: number;
  contentBottomPt: number;
  /** Header area Y position (top edge of header text baseline area) */
  headerYPt: number;
  /** Footer area Y position (baseline Y for footer text) */
  footerYPt: number;
};

/**
 * Normalized header/footer configuration with all defaults applied.
 * @internal
 */
export type NormalizedHeaderFooter = {
  header: { left: string; center: string; right: string };
  footer: { left: string; center: string; right: string };
  fontSizePt: number;
  skipFirstPage: boolean;
  showSeparator: boolean;
};

/**
 * Internal normalized options with all defaults applied.
 * @internal
 */
export type NormalizedTypesetOptions = TypesetOptions & {
  features: NormalizedTypesetFeatures;
  headerFooter: NormalizedHeaderFooter;
  page: TypesetOptions["page"] & {
    resolved: ResolvedPage;
  };
};

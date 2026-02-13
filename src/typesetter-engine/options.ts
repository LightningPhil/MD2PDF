/**
 * Typesetter option defaults and normalization helpers.
 *
 * Purpose:
 * - Keep one authoritative source of runtime defaults.
 * - Convert user options to a fully normalized internal form.
 *
 * Usage:
 * - `createTypesetter` runs `createDefaultOptions` followed by `normalizeOptions`.
 */
import type { MarginPt, NormalizedTypesetOptions, PageSizePreset, TypesetOptions } from "./types";

// Page size dimensions in points (1pt = 1/72 inch)
// ISO A-series and US paper sizes
const PAGE_SIZES: Record<PageSizePreset, { widthPt: number; heightPt: number }> = {
  A5: { widthPt: 419.5275590551181, heightPt: 595.2755905511812 },   // 148mm × 210mm
  A4: { widthPt: 595.2755905511812, heightPt: 841.8897637795277 },   // 210mm × 297mm
  A3: { widthPt: 841.8897637795277, heightPt: 1190.5511811023623 },  // 297mm × 420mm
  Letter: { widthPt: 612, heightPt: 792 },                           // 8.5" × 11"
  Legal: { widthPt: 612, heightPt: 1008 },                           // 8.5" × 14"
  Tabloid: { widthPt: 792, heightPt: 1224 }                          // 11" × 17"
};

// Margin presets in points
const MARGIN_PRESETS: Record<"Narrow" | "Medium" | "Wide", MarginPt> = {
  Narrow: { top: 36, right: 36, bottom: 36, left: 36 },        // ~12.7mm (0.5")
  Medium: { top: 72, right: 72, bottom: 72, left: 72 },        // ~25.4mm (1")
  Wide: { top: 144, right: 144, bottom: 144, left: 144 }       // ~50.8mm (2")
};

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

/**
 * Resolve margin configuration to concrete MarginPt values.
 */
function resolveMargin(margin: TypesetOptions["page"]["margin"]): MarginPt {
  if (typeof margin === "string") {
    return MARGIN_PRESETS[margin];
  }
  return margin;
}

/**
 * Resolve page size to concrete dimensions.
 */
function resolvePageSize(size: TypesetOptions["page"]["size"]): { widthPt: number; heightPt: number } {
  if (typeof size === "string") {
    return PAGE_SIZES[size];
  }
  return size;
}

export function createDefaultOptions(overrides: TypesetOptions): TypesetOptions {
  // User-facing defaults live here so behavior stays easy to reason about.
  const page = {
    size: "A4" as const,
    margin: "Medium" as const
  };

  const headerFooter = {
    header: { left: "", center: "", right: "" },
    footer: { left: "", center: "", right: "" },
    fontSizePt: 10,
    skipFirstPage: false,
    showSeparator: false
  };

  const typography = {
    baseFontSizePt: 12,
    lineHeight: 1.35,
    paragraphSpacingPt: 6,
    headingScale: { h1: 2, h2: 1.6, h3: 1.3 }
  };

  const features = {
    tables: true,
    codeBlocks: {
      background: true,
      border: true,
      lineNumbers: false,
      wrapLongLines: true,
      paddingPt: 6,
      tabSize: 4
    },
    math: {
      environments: true,
      stretchyDelimiters: "scale" as const,
      accents: true,
      bigOperators: true,
      debugOverlays: false
    },
    emoji: {
      mode: "preserve" as const,
      replacement: "~"
    },
    typography: {
      hyphenation: false,
      justification: false,
      widowOrphanControl: true,
      hyphenMinPrefix: 3,
      hyphenMinSuffix: 3,
      justifyMinLineFill: 0.8,
      linkUnderline: false,
      linkUnderlineMode: "smart" as const,
      linkUnderlineMinOffsetEm: 0.11,
      linkUnderlineMaxThicknessEm: 0.06,
      debugDecorations: false
    }
  };

  // Resolve user margin - could be preset or custom
  const userMargin = overrides.page?.margin;
  const resolvedUserMargin = userMargin ? resolveMargin(userMargin) : resolveMargin(page.margin);

  return {
    page: {
      size: overrides.page?.size ?? page.size,
      margin: resolvedUserMargin
    },
    headerFooter: {
      header: {
        left: overrides.headerFooter?.header?.left ?? headerFooter.header.left,
        center: overrides.headerFooter?.header?.center ?? headerFooter.header.center,
        right: overrides.headerFooter?.header?.right ?? headerFooter.header.right
      },
      footer: {
        left: overrides.headerFooter?.footer?.left ?? headerFooter.footer.left,
        center: overrides.headerFooter?.footer?.center ?? headerFooter.footer.center,
        right: overrides.headerFooter?.footer?.right ?? headerFooter.footer.right
      },
      fontSizePt: overrides.headerFooter?.fontSizePt ?? headerFooter.fontSizePt,
      skipFirstPage: overrides.headerFooter?.skipFirstPage ?? headerFooter.skipFirstPage,
      showSeparator: overrides.headerFooter?.showSeparator ?? headerFooter.showSeparator,
      headerMarginPt: overrides.headerFooter?.headerMarginPt,
      footerMarginPt: overrides.headerFooter?.footerMarginPt,
      separatorWidthPt: overrides.headerFooter?.separatorWidthPt,
      separatorGapPt: overrides.headerFooter?.separatorGapPt
    },
    typography: {
      baseFontSizePt:
        overrides.typography?.baseFontSizePt ?? typography.baseFontSizePt,
      lineHeight: overrides.typography?.lineHeight ?? typography.lineHeight,
      paragraphSpacingPt:
        overrides.typography?.paragraphSpacingPt ?? typography.paragraphSpacingPt,
      headingScale: {
        h1: overrides.typography?.headingScale.h1 ?? typography.headingScale.h1,
        h2: overrides.typography?.headingScale.h2 ?? typography.headingScale.h2,
        h3: overrides.typography?.headingScale.h3 ?? typography.headingScale.h3
      }
    },
    fonts: {
      text: overrides.fonts.text,
      textBold: overrides.fonts?.textBold,
      textItalic: overrides.fonts?.textItalic,
      textBoldItalic: overrides.fonts?.textBoldItalic,
      mono: overrides.fonts?.mono,
      math: overrides.fonts.math,
      fallback: overrides.fonts?.fallback ?? []
    },
    features: {
      tables: overrides.features?.tables ?? features.tables,
      codeBlocks: {
        background:
          overrides.features?.codeBlocks?.background ?? features.codeBlocks.background,
        border: overrides.features?.codeBlocks?.border ?? features.codeBlocks.border,
        lineNumbers:
          overrides.features?.codeBlocks?.lineNumbers ?? features.codeBlocks.lineNumbers,
        wrapLongLines:
          overrides.features?.codeBlocks?.wrapLongLines ?? features.codeBlocks.wrapLongLines,
        paddingPt: overrides.features?.codeBlocks?.paddingPt ?? features.codeBlocks.paddingPt,
        tabSize: overrides.features?.codeBlocks?.tabSize ?? features.codeBlocks.tabSize
      },
      math: {
        environments:
          overrides.features?.math?.environments ?? features.math.environments,
        stretchyDelimiters:
          overrides.features?.math?.stretchyDelimiters ?? features.math.stretchyDelimiters,
        accents: overrides.features?.math?.accents ?? features.math.accents,
        bigOperators: overrides.features?.math?.bigOperators ?? features.math.bigOperators,
        debugOverlays:
          overrides.features?.math?.debugOverlays ?? features.math.debugOverlays
      },
      emoji: {
        mode: overrides.features?.emoji?.mode ?? features.emoji.mode,
        replacement: sanitizeEmojiReplacement(
          overrides.features?.emoji?.replacement ?? features.emoji.replacement
        )
      },
      typography: {
        hyphenation:
          overrides.features?.typography?.hyphenation ?? features.typography.hyphenation,
        justification:
          overrides.features?.typography?.justification ?? features.typography.justification,
        widowOrphanControl:
          overrides.features?.typography?.widowOrphanControl ??
          features.typography.widowOrphanControl,
        hyphenMinPrefix:
          overrides.features?.typography?.hyphenMinPrefix ??
          features.typography.hyphenMinPrefix,
        hyphenMinSuffix:
          overrides.features?.typography?.hyphenMinSuffix ??
          features.typography.hyphenMinSuffix,
        justifyMinLineFill:
          overrides.features?.typography?.justifyMinLineFill ??
          features.typography.justifyMinLineFill,
        linkUnderline:
          overrides.features?.typography?.linkUnderline ??
          features.typography.linkUnderline,
        linkUnderlineMode:
          overrides.features?.typography?.linkUnderlineMode ??
          features.typography.linkUnderlineMode,
        linkUnderlineMinOffsetEm:
          overrides.features?.typography?.linkUnderlineMinOffsetEm ??
          features.typography.linkUnderlineMinOffsetEm,
        linkUnderlineMaxThicknessEm:
          overrides.features?.typography?.linkUnderlineMaxThicknessEm ??
          features.typography.linkUnderlineMaxThicknessEm,
        debugDecorations:
          overrides.features?.typography?.debugDecorations ??
          features.typography.debugDecorations
      }
    }
  };
}

export function normalizeOptions(options: TypesetOptions): NormalizedTypesetOptions {
  // Resolve page size
  const pageSize = resolvePageSize(options.page.size);
  const widthPt = pageSize.widthPt;
  const heightPt = pageSize.heightPt;

  // Resolve margins
  const marginPt = resolveMargin(options.page.margin);

  // Resolve header/footer with defaults
  const hfFontSizePt = sanitizeNumber(
    options.headerFooter?.fontSizePt,
    10,
    { min: 4, max: 96 }
  );
  const separatorWidthPt = sanitizeNumber(
    options.headerFooter?.separatorWidthPt,
    0.5,
    { min: 0, max: 12 }
  );
  const separatorGapPt = sanitizeNumber(
    options.headerFooter?.separatorGapPt,
    4,
    { min: 0, max: 72 }
  );
  
  // Calculate header/footer margin defaults if not specified
  // Default: position text baseline so it's vertically centered in margin space,
  // but at minimum 50% from page edge, accounting for text ascent (~70% of font size)
  const defaultHeaderMargin = Math.max(
    marginPt.top / 2 + hfFontSizePt * 0.35,
    hfFontSizePt * 1.2
  );
  const defaultFooterMargin = Math.max(
    marginPt.bottom / 2 - hfFontSizePt * 0.35,
    hfFontSizePt * 0.5
  );
  
  const headerMarginPt = sanitizeNumber(
    options.headerFooter?.headerMarginPt,
    defaultHeaderMargin,
    { min: 0, max: heightPt }
  );
  const footerMarginPt = sanitizeNumber(
    options.headerFooter?.footerMarginPt,
    defaultFooterMargin,
    { min: 0, max: heightPt }
  );
  
  const headerFooter = {
    header: {
      left: options.headerFooter?.header?.left ?? "",
      center: options.headerFooter?.header?.center ?? "",
      right: options.headerFooter?.header?.right ?? ""
    },
    footer: {
      left: options.headerFooter?.footer?.left ?? "",
      center: options.headerFooter?.footer?.center ?? "",
      right: options.headerFooter?.footer?.right ?? ""
    },
    fontSizePt: hfFontSizePt,
    skipFirstPage: options.headerFooter?.skipFirstPage ?? false,
    showSeparator: options.headerFooter?.showSeparator ?? false,
    headerMarginPt,
    footerMarginPt,
    separatorWidthPt,
    separatorGapPt
  };

  // Content area: headers/footers are positioned WITHIN the margins,
  // so they do not affect the content area dimensions
  const contentXPt = marginPt.left;
  const contentYPt = marginPt.top;
  const contentWPt = widthPt - marginPt.left - marginPt.right;
  const contentHPt = heightPt - marginPt.top - marginPt.bottom;

  // Header baseline Y: distance from TOP of page (positioned in top margin)
  // headerMarginPt is the distance from top page edge to baseline
  const headerYPt = headerMarginPt;
  // Footer baseline Y: distance from TOP of page (positioned in bottom margin)
  // footerMarginPt is the distance from bottom page edge to baseline
  const footerYPt = heightPt - footerMarginPt;

  return {
    ...options,
    headerFooter,
    features: {
      tables: options.features?.tables ?? true,
      codeBlocks: {
        background: options.features?.codeBlocks?.background ?? true,
        border: options.features?.codeBlocks?.border ?? true,
        lineNumbers: options.features?.codeBlocks?.lineNumbers ?? false,
        wrapLongLines: options.features?.codeBlocks?.wrapLongLines ?? true,
        paddingPt: options.features?.codeBlocks?.paddingPt ?? 6,
        tabSize: options.features?.codeBlocks?.tabSize ?? 4
      },
      math: {
        environments: options.features?.math?.environments ?? true,
        stretchyDelimiters: options.features?.math?.stretchyDelimiters ?? "scale",
        accents: options.features?.math?.accents ?? true,
        bigOperators: options.features?.math?.bigOperators ?? true,
        debugOverlays: options.features?.math?.debugOverlays ?? false
      },
      emoji: {
        mode: options.features?.emoji?.mode ?? "preserve",
        replacement: sanitizeEmojiReplacement(options.features?.emoji?.replacement)
      },
      typography: {
        // Clampable controls get deterministic fallbacks to avoid unstable layout.
        hyphenation: options.features?.typography?.hyphenation ?? false,
        justification: options.features?.typography?.justification ?? false,
        widowOrphanControl: options.features?.typography?.widowOrphanControl ?? true,
        hyphenMinPrefix: options.features?.typography?.hyphenMinPrefix ?? 3,
        hyphenMinSuffix: options.features?.typography?.hyphenMinSuffix ?? 3,
        justifyMinLineFill: options.features?.typography?.justifyMinLineFill ?? 0.8,
        linkUnderline: options.features?.typography?.linkUnderline ?? false,
        linkUnderlineMode: options.features?.typography?.linkUnderlineMode ?? "smart",
        linkUnderlineMinOffsetEm:
          options.features?.typography?.linkUnderlineMinOffsetEm ?? 0.11,
        linkUnderlineMaxThicknessEm:
          options.features?.typography?.linkUnderlineMaxThicknessEm ?? 0.06,
        debugDecorations: options.features?.typography?.debugDecorations ?? false
      }
    },
    page: {
      ...options.page,
      resolved: {
        widthPt,
        heightPt,
        marginPt,
        contentXPt,
        contentYPt,
        contentWPt,
        contentHPt,
        contentBottomPt: contentYPt + contentHPt,
        headerYPt,
        footerYPt
      }
    }
  };
}

function sanitizeNumber(
  value: number | undefined,
  fallback: number,
  bounds?: { min?: number; max?: number }
): number {
  const min = bounds?.min ?? Number.NEGATIVE_INFINITY;
  const max = bounds?.max ?? Number.POSITIVE_INFINITY;
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function sanitizeEmojiReplacement(value: string | undefined): string {
  if (typeof value !== "string") {
    return "~";
  }
  return value.length > 0 ? value : "~";
}

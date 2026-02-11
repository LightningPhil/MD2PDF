/**
 * Font metrics provider used by the layout and renderer pipeline.
 *
 * Purpose:
 * - Parse OpenType tables once per registered font.
 * - Expose deterministic ascent/descent/glyph advance metrics in point units.
 * - Resolve fallback fonts for missing glyphs in a stable order.
 *
 * Usage:
 * - Instantiated by `createTypesetter` and shared across layout + renderers.
 * - Layout code uses it for all sizing and decoration placement decisions.
 */
import opentype from "opentype.js";

import type { FontSpec } from "./types";
import { splitGraphemes } from "./text/graphemes";
import { getRenderableGraphemeParts, shouldUseEmojiMetricsFallback } from "./text/emoji";

type ParsedGlyph = {
  advanceWidth?: number;
  yMin?: number;
  yMax?: number;
};

type ParsedOpenTypeFont = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  tables?: {
    post?: {
      underlinePosition?: number;
      underlineThickness?: number;
    };
    os2?: {
      yStrikeoutPosition?: number;
      yStrikeoutSize?: number;
      sxHeight?: number;
    };
  };
  charToGlyphIndex?: (char: string) => number;
  charToGlyph: (char: string) => ParsedGlyph;
  stringToGlyphs?: (text: string) => ParsedGlyph[];
};

type GlyphMetricsAtEm = {
  widthAtEm: number;
  ascentAtEm: number;
  descentAtEm: number;
};

const EMOJI_ADVANCE_AT_EM = 1;
const EMOJI_ASCENT_AT_EM = 0.86;
const EMOJI_DESCENT_AT_EM = 0.14;

type RegisteredFont = {
  spec: FontSpec;
  parsed?: ParsedOpenTypeFont;
  glyphMetricsAtEmCache: Map<string, GlyphMetricsAtEm>;
  ascentAtEm: number;
  descentAtEm: number;
  underlineOffsetAtEm: number;
  underlineThicknessAtEm: number;
  strikeOffsetAtEm: number;
  strikeThicknessAtEm: number;
};

export class FontMetricsProvider {
  private readonly fonts = new Map<string, RegisteredFont>();
  private readonly canvasFontPromises = new Map<string, Promise<void>>();
  private readonly fontOrder: string[] = [];
  // Cache primary->resolved font mapping per character for deterministic speedups.
  private readonly resolvedFontCache = new Map<string, string>();

  constructor(specs: FontSpec[]) {
    for (const spec of specs) {
      this.register(spec);
    }
  }

  register(spec: FontSpec): void {
    if (this.fonts.has(spec.id)) {
      return;
    }

    let parsed: ParsedOpenTypeFont | undefined;
    let ascentAtEm = 0.8;
    let descentAtEm = 0.2;
    let underlineOffsetAtEm = 0.1;
    let underlineThicknessAtEm = 0.05;
    let strikeOffsetAtEm = -0.3;
    let strikeThicknessAtEm = 0.06;

    try {
      parsed = (opentype as { parse: (buffer: ArrayBuffer) => ParsedOpenTypeFont }).parse(
        spec.source
      );
      ascentAtEm = parsed.ascender / parsed.unitsPerEm;
      descentAtEm = Math.abs(parsed.descender / parsed.unitsPerEm);

      const underlinePosition = parsed.tables?.post?.underlinePosition;
      const underlineThickness = parsed.tables?.post?.underlineThickness;
      if (typeof underlinePosition === "number") {
        underlineOffsetAtEm = -(underlinePosition / parsed.unitsPerEm);
      }
      if (typeof underlineThickness === "number" && underlineThickness > 0) {
        underlineThicknessAtEm = underlineThickness / parsed.unitsPerEm;
      }

      const strikePosition = parsed.tables?.os2?.yStrikeoutPosition;
      const strikeThickness = parsed.tables?.os2?.yStrikeoutSize;
      if (typeof strikePosition === "number") {
        let strikePosAtEm = strikePosition / parsed.unitsPerEm;
        const sxHeight = parsed.tables?.os2?.sxHeight;
        if (typeof sxHeight === "number" && sxHeight > 0) {
          const maxPosAtEm = (sxHeight / parsed.unitsPerEm) * 0.5;
          strikePosAtEm = Math.min(strikePosAtEm, maxPosAtEm);
        }
        strikeOffsetAtEm = -strikePosAtEm;
      }
      if (typeof strikeThickness === "number" && strikeThickness > 0) {
        strikeThicknessAtEm = strikeThickness / parsed.unitsPerEm;
      }
    } catch {
      // Keep deterministic fallback metrics when the font cannot be parsed.
      parsed = undefined;
    }

    this.fonts.set(spec.id, {
      spec,
      parsed,
      glyphMetricsAtEmCache: new Map<string, GlyphMetricsAtEm>(),
      ascentAtEm,
      descentAtEm,
      underlineOffsetAtEm,
      underlineThicknessAtEm,
      strikeOffsetAtEm,
      strikeThicknessAtEm
    });
    this.fontOrder.push(spec.id);
  }

  getFontIds(): string[] {
    return Array.from(this.fonts.keys());
  }

  getFontSpec(fontId: string): FontSpec {
    const font = this.fonts.get(fontId);
    if (!font) {
      throw new Error(`Unknown font id: ${fontId}`);
    }
    return font.spec;
  }

  getCssFamily(fontId: string): string {
    const font = this.fonts.get(fontId);
    if (!font) {
      throw new Error(`Unknown font id: ${fontId}`);
    }
    return font.spec.cssFamily ?? fontId;
  }

  getAscent(fontId: string, fontSizePt: number): number {
    const font = this.requireFont(fontId);
    return font.ascentAtEm * fontSizePt;
  }

  getDescent(fontId: string, fontSizePt: number): number {
    const font = this.requireFont(fontId);
    return font.descentAtEm * fontSizePt;
  }

  getAdvanceWidth(fontId: string, char: string, fontSizePt: number): number {
    const resolvedFontId = this.resolveFontForChar(fontId, char);
    return this.getAdvanceWidthForResolvedFont(resolvedFontId, char, fontSizePt);
  }

  getUnderlineMetrics(
    fontId: string,
    fontSizePt: number
  ): { offsetPt: number; thicknessPt: number } {
    const font = this.requireFont(fontId);
    return {
      offsetPt: font.underlineOffsetAtEm * fontSizePt,
      thicknessPt: Math.max(0.4, font.underlineThicknessAtEm * fontSizePt)
    };
  }

  getStrikeMetrics(
    fontId: string,
    fontSizePt: number
  ): { offsetPt: number; thicknessPt: number } {
    const font = this.requireFont(fontId);
    return {
      offsetPt: font.strikeOffsetAtEm * fontSizePt,
      thicknessPt: Math.max(0.4, font.strikeThicknessAtEm * fontSizePt)
    };
  }

  getGlyphMetrics(
    fontId: string,
    char: string,
    fontSizePt: number
  ): { fontId: string; widthPt: number; ascentPt: number; descentPt: number } {
    const resolvedFontId = this.resolveFontForChar(fontId, char);
    const metrics = this.getGlyphMetricsAtEm(resolvedFontId, char);
    return {
      fontId: resolvedFontId,
      widthPt: metrics.widthAtEm * fontSizePt,
      ascentPt: metrics.ascentAtEm * fontSizePt,
      descentPt: metrics.descentAtEm * fontSizePt
    };
  }

  resolveFontForChar(primaryFontId: string, char: string): string {
    const key = `${primaryFontId}|${char}`;
    const cached = this.resolvedFontCache.get(key);
    if (cached) {
      return cached;
    }

    if (this.canDisplayChar(primaryFontId, char)) {
      this.resolvedFontCache.set(key, primaryFontId);
      return primaryFontId;
    }

    // Probe fallbacks in declared registration order so results are stable.
    for (const candidate of this.fontOrder) {
      if (candidate === primaryFontId) {
        continue;
      }
      if (this.canDisplayChar(candidate, char)) {
        this.resolvedFontCache.set(key, candidate);
        return candidate;
      }
    }

    this.resolvedFontCache.set(key, primaryFontId);
    return primaryFontId;
  }

  canDisplayChar(fontId: string, char: string): boolean {
    const font = this.requireFont(fontId);
    const parts = getRenderableGraphemeParts(char);
    const effectiveParts = parts.length > 0 ? parts : char ? [char] : [];

    if (effectiveParts.length === 0) {
      return true;
    }

    if (!font.parsed) {
      if (shouldUseEmojiMetricsFallback(char)) {
        return false;
      }
      return effectiveParts.every((part) => part.charCodeAt(0) < 128);
    }

    return effectiveParts.every((part) => this.canDisplayPart(font.parsed!, part));
  }

  private getGlyphMetricsAtEm(fontId: string, char: string): GlyphMetricsAtEm {
    const font = this.requireFont(fontId);
    const cached = font.glyphMetricsAtEmCache.get(char);
    if (cached) {
      return cached;
    }

    const shouldUseEmojiFallback = shouldUseEmojiMetricsFallback(char);
    const hasGlyphSupport = this.canDisplayChar(fontId, char);

    let widthAtEm = 0.6;
    let ascentAtEm = font.ascentAtEm;
    let descentAtEm = font.descentAtEm;

    if (shouldUseEmojiFallback && !hasGlyphSupport) {
      ascentAtEm = Math.max(ascentAtEm, EMOJI_ASCENT_AT_EM);
      descentAtEm = Math.max(descentAtEm, EMOJI_DESCENT_AT_EM);
    } else if (font.parsed) {
      const glyphs = this.getGlyphSequence(font.parsed, char);
      if (glyphs.length > 0) {
        let totalAdvance = 0;
        let maxY = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;

        for (const glyph of glyphs) {
          totalAdvance += glyph.advanceWidth ?? 0;
          if (typeof glyph.yMax === "number" && Number.isFinite(glyph.yMax)) {
            maxY = Math.max(maxY, glyph.yMax);
          }
          if (typeof glyph.yMin === "number" && Number.isFinite(glyph.yMin)) {
            minY = Math.min(minY, glyph.yMin);
          }
        }

        widthAtEm = (totalAdvance || font.parsed.unitsPerEm * 0.6) / font.parsed.unitsPerEm;
        if (maxY > 0) {
          ascentAtEm = maxY / font.parsed.unitsPerEm;
        }
        if (minY < 0) {
          descentAtEm = -minY / font.parsed.unitsPerEm;
        }
      }
    } else if (char === " ") {
      widthAtEm = 0.33;
    } else if (/[il\.,'`]/.test(char)) {
      widthAtEm = 0.35;
    } else if (/[mwMW@#]/.test(char)) {
      widthAtEm = 0.9;
    }

    if (shouldUseEmojiFallback) {
      // Keep emoji spacing deterministic: all emoji-like graphemes consume one cell.
      widthAtEm = EMOJI_ADVANCE_AT_EM;
      ascentAtEm = Math.max(ascentAtEm, EMOJI_ASCENT_AT_EM);
      descentAtEm = Math.max(descentAtEm, EMOJI_DESCENT_AT_EM);
    }

    const metrics: GlyphMetricsAtEm = {
      widthAtEm,
      ascentAtEm: Math.max(0.01, ascentAtEm),
      descentAtEm: Math.max(0, descentAtEm)
    };
    font.glyphMetricsAtEmCache.set(char, metrics);
    return metrics;
  }

  private getGlyphSequence(parsed: ParsedOpenTypeFont, text: string): ParsedGlyph[] {
    if (typeof parsed.stringToGlyphs === "function") {
      try {
        const glyphs = parsed.stringToGlyphs(text);
        if (Array.isArray(glyphs) && glyphs.length > 0) {
          return glyphs;
        }
      } catch {
        // Fall through to deterministic per-code-point approximation.
      }
    }

    const codePoints = Array.from(text);
    return codePoints.map((part) => parsed.charToGlyph(part)).filter(Boolean);
  }

  private getAdvanceWidthForResolvedFont(fontId: string, char: string, fontSizePt: number): number {
    return this.getGlyphMetricsAtEm(fontId, char).widthAtEm * fontSizePt;
  }

  private canDisplayPart(parsed: ParsedOpenTypeFont, part: string): boolean {
    if (typeof parsed.charToGlyphIndex === "function") {
      return parsed.charToGlyphIndex(part) > 0;
    }

    const glyph = parsed.charToGlyph(part);
    return (glyph?.advanceWidth ?? 0) > 0;
  }

  getTextWidth(fontId: string, text: string, fontSizePt: number): number {
    let width = 0;
    for (const grapheme of splitGraphemes(text)) {
      width += this.getAdvanceWidth(fontId, grapheme, fontSizePt);
    }
    return width;
  }

  async ensureCanvasFontsLoaded(): Promise<void> {
    if (typeof document === "undefined" || typeof FontFace === "undefined") {
      return;
    }

    await Promise.all(this.getFontIds().map((fontId) => this.ensureCanvasFontLoaded(fontId)));
  }

  getFontBytes(fontId: string): Uint8Array {
    const font = this.requireFont(fontId);
    return new Uint8Array(font.spec.source.slice(0));
  }

  private ensureCanvasFontLoaded(fontId: string): Promise<void> {
    const cached = this.canvasFontPromises.get(fontId);
    if (cached) {
      return cached;
    }

    const promise = (async () => {
      const font = this.requireFont(fontId);
      const family = this.getCssFamily(fontId);

      if (font.spec.source.byteLength === 0) {
        return;
      }

      try {
        const face = new FontFace(
          family,
          font.spec.source.slice(0)
        );
        await face.load();
        document.fonts.add(face);
        await document.fonts.ready;
      } catch {
        // Fallback to system font family if font bytes are unavailable/invalid.
      }
    })();

    this.canvasFontPromises.set(fontId, promise);
    return promise;
  }

  private requireFont(fontId: string): RegisteredFont {
    const font = this.fonts.get(fontId);
    if (!font) {
      throw new Error(`Unknown font id: ${fontId}`);
    }
    return font;
  }
}

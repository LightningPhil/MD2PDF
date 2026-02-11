/**
 * PDF renderer for page display lists.
 *
 * Purpose:
 * - Paint precomputed `DrawOp` geometry into a PDF using pdf-lib.
 * - Embed configured fonts and emit deterministic link annotations.
 *
 * Usage:
 * - Invoked by `typesetter.renderToPdf(...)`.
 * - Consumes layout geometry directly; no reflow or relayout should happen here.
 */
import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

import { FontMetricsProvider } from "../font-metrics";
import type { DrawOp, PageLayout, PdfOptions } from "../types";
import { splitGraphemes } from "../text/graphemes";
import { shouldUseEmojiMetricsFallback } from "../text/emoji";

type EmbeddedPdfFont = Awaited<ReturnType<PDFDocument["embedFont"]>>;
type EmbeddedPdfImage = Awaited<ReturnType<PDFDocument["embedPng"]>>;
type EmojiRenderMode = NonNullable<PdfOptions["emojiRenderMode"]>;
type EmojiUsage = {
  grapheme: string;
  cssFamily: string;
  maxCellPt: number;
};

const EMOJI_IMAGE_PX_PER_PT = 4;
const EMOJI_IMAGE_MIN_PX = 64;
const EMOJI_IMAGE_MAX_PX = 512;
const EMOJI_HORIZONTAL_PAD_LEFT_RATIO = 0.02;
const EMOJI_HORIZONTAL_PAD_RIGHT_RATIO = 0.14;
const EMOJI_VERTICAL_PAD_RATIO = 0.1;
const EMOJI_FIT_MARGIN_RATIO = 0.02;
const EMOJI_INK_ADVANCE_BLEND = 0.3;
const EMOJI_RIGHT_SAFETY_AT_EM = 0.06;

export async function renderPagesToPdf(
  pages: PageLayout[],
  metrics: FontMetricsProvider,
  options?: PdfOptions
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  if (options?.title) {
    pdf.setTitle(options.title);
  }
  if (options?.author) {
    pdf.setAuthor(options.author);
  }
  if (options?.subject) {
    pdf.setSubject(options.subject);
  }
  if (options?.keywords?.length) {
    pdf.setKeywords(options.keywords);
  }

  const embeddedFonts = new Map<string, EmbeddedPdfFont>();
  const emojiRenderMode: EmojiRenderMode = options?.emojiRenderMode ?? "font";
  const emojiImageCache = await buildEmojiImageCache(emojiRenderMode, pages, metrics, pdf);
  const fallbackFont = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSubsetting = options?.fontSubsetting ?? true;
  const usedFontIds = collectUsedFontIds(pages, metrics, emojiImageCache);
  const fontIdsToEmbed =
    usedFontIds.size > 0 ? Array.from(usedFontIds) : metrics.getFontIds();

  for (const fontId of fontIdsToEmbed) {
    try {
      const bytes = metrics.getFontBytes(fontId);
      if (bytes.byteLength === 0) {
        embeddedFonts.set(fontId, fallbackFont);
        continue;
      }
      const embedded = await pdf.embedFont(bytes, { subset: fontSubsetting });
      embeddedFonts.set(fontId, embedded);
    } catch {
      // Fall back to a standard PDF font when custom embedding fails.
      embeddedFonts.set(fontId, fallbackFont);
    }
  }

  for (const pageLayout of pages) {
    const page = pdf.addPage([pageLayout.widthPt, pageLayout.heightPt]);
    for (const op of pageLayout.ops) {
      drawOp(
        op,
        pageLayout.heightPt,
        page,
        embeddedFonts,
        fallbackFont,
        emojiImageCache,
        metrics,
        pdf
      );
    }
  }

  return pdf.save({
    useObjectStreams: options?.compress ?? true
  });
}

function drawOp(
  op: DrawOp,
  pageHeightPt: number,
  page: ReturnType<PDFDocument["addPage"]>,
  embeddedFonts: Map<string, EmbeddedPdfFont>,
  fallbackFont: EmbeddedPdfFont,
  emojiImageCache: Map<string, EmbeddedPdfImage>,
  metrics: FontMetricsProvider,
  pdf: PDFDocument
): void {
  if (op.kind === "glyph") {
    drawGlyph(
      op.char,
      op.fontId,
      op.fontSizePt,
      op.xPt,
      op.yBaselinePt,
      pageHeightPt,
      page,
      embeddedFonts,
      fallbackFont,
      emojiImageCache,
      metrics
    );
    return;
  }

  if (op.kind === "glyphRun") {
    const graphemes = splitGraphemes(op.text);
    if (op.xOffsetsPt && op.xOffsetsPt.length >= graphemes.length) {
      for (let i = 0; i < graphemes.length; i += 1) {
        drawGlyph(
          graphemes[i],
          op.fontId,
          op.fontSizePt,
          op.xPt + op.xOffsetsPt[i],
          op.yBaselinePt,
          pageHeightPt,
          page,
          embeddedFonts,
          fallbackFont,
          emojiImageCache,
          metrics
        );
      }
      return;
    }

    let x = op.xPt;
    for (const grapheme of graphemes) {
      drawGlyph(
        grapheme,
        op.fontId,
        op.fontSizePt,
        x,
        op.yBaselinePt,
        pageHeightPt,
        page,
        embeddedFonts,
        fallbackFont,
        emojiImageCache,
        metrics
      );
      x += metrics.getAdvanceWidth(op.fontId, grapheme, op.fontSizePt);
    }
    return;
  }

  if (op.kind === "textSpan") {
    for (const child of op.ops) {
      drawOp(
        child,
        pageHeightPt,
        page,
        embeddedFonts,
        fallbackFont,
        emojiImageCache,
        metrics,
        pdf
      );
    }
    return;
  }

  if (op.kind === "link") {
    addLinkAnnotation(pdf, page, pageHeightPt, op.xPt, op.yPt, op.wPt, op.hPt, op.href);
    return;
  }

  if (op.kind === "underline" || op.kind === "strikethrough") {
    const yPdf = pageHeightPt - (op.yPt + op.thicknessPt);
    const color = op.colorRgb
      ? rgb(op.colorRgb[0], op.colorRgb[1], op.colorRgb[2])
      : rgb(0, 0, 0);
    page.drawRectangle({
      x: op.xPt,
      y: yPdf,
      width: op.wPt,
      height: op.thicknessPt,
      color,
      borderWidth: 0
    });
    return;
  }

  if (op.kind === "rule") {
    const yPdf = pageHeightPt - (op.yPt + op.hPt);
    const color = op.colorRgb
      ? rgb(op.colorRgb[0], op.colorRgb[1], op.colorRgb[2])
      : rgb(0, 0, 0);
    page.drawRectangle({
      x: op.xPt,
      y: yPdf,
      width: op.wPt,
      height: op.hPt,
      color,
      borderWidth: 0
    });
  }
}

function addLinkAnnotation(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["addPage"]>,
  pageHeightPt: number,
  xPt: number,
  yPt: number,
  wPt: number,
  hPt: number,
  href: string
): void {
  const yBottom = pageHeightPt - (yPt + hPt);
  const rect = [xPt, yBottom, xPt + wPt, yBottom + hPt];

  const annotation = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(href)
    }
  });
  const annotationRef = pdf.context.register(annotation);

  const pageNode = page.node as unknown as {
    lookupMaybe: (name: PDFName, type: typeof PDFArray) => PDFArray | undefined;
    set: (name: PDFName, value: PDFArray) => void;
  };
  let annots = pageNode.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annots) {
    annots = pdf.context.obj([]) as PDFArray;
    pageNode.set(PDFName.of("Annots"), annots);
  }
  annots.push(annotationRef);
}

function drawGlyph(
  char: string,
  fontId: string,
  fontSizePt: number,
  xPt: number,
  yBaselinePt: number,
  pageHeightPt: number,
  page: ReturnType<PDFDocument["addPage"]>,
  embeddedFonts: Map<string, EmbeddedPdfFont>,
  fallbackFont: EmbeddedPdfFont,
  emojiImageCache: Map<string, EmbeddedPdfImage>,
  metrics: FontMetricsProvider
): void {
  const emojiImage = resolveEmojiImage(char, fontId, metrics, emojiImageCache);
  if (emojiImage) {
    const glyph = metrics.getGlyphMetrics(fontId, char, fontSizePt);
    const widthPt = Math.max(0.01, glyph.widthPt);
    const heightPt = Math.max(0.01, glyph.ascentPt + glyph.descentPt);
    const topYPt = yBaselinePt - glyph.ascentPt;
    const yPdf = pageHeightPt - (topYPt + heightPt);

    page.drawImage(emojiImage, {
      x: xPt,
      y: yPdf,
      width: widthPt,
      height: heightPt
    });
    return;
  }

  const font = embeddedFonts.get(fontId) ?? fallbackFont;
  // Layout uses y-down baseline coordinates, PDF uses y-up.
  // drawText anchors at baseline, so a direct axis flip is correct.
  const yPdf = pageHeightPt - yBaselinePt;

  try {
    page.drawText(char, {
      x: xPt,
      y: yPdf,
      size: fontSizePt,
      font,
      color: rgb(0, 0, 0)
    });
  } catch {
    // Some fallback standard fonts cannot encode supplementary-plane emoji.
    page.drawText("~", {
      x: xPt,
      y: yPdf,
      size: fontSizePt,
      font,
      color: rgb(0, 0, 0)
    });
  }
}

function collectUsedFontIds(
  pages: PageLayout[],
  metrics: FontMetricsProvider,
  emojiImageCache: Map<string, EmbeddedPdfImage>
): Set<string> {
  const used = new Set<string>();
  for (const page of pages) {
    for (const op of page.ops) {
      collectOpFonts(op, used, metrics, emojiImageCache);
    }
  }
  return used;
}

function collectOpFonts(
  op: DrawOp,
  used: Set<string>,
  metrics: FontMetricsProvider,
  emojiImageCache: Map<string, EmbeddedPdfImage>
): void {
  if (op.kind === "glyph") {
    if (!resolveEmojiImage(op.char, op.fontId, metrics, emojiImageCache)) {
      used.add(op.fontId);
    }
    return;
  }

  if (op.kind === "glyphRun") {
    const graphemes = splitGraphemes(op.text);
    const hasFontDrawnGlyph = graphemes.some(
      (grapheme) => !resolveEmojiImage(grapheme, op.fontId, metrics, emojiImageCache)
    );
    if (hasFontDrawnGlyph) {
      used.add(op.fontId);
    }
    return;
  }

  if (op.kind === "textSpan") {
    for (const child of op.ops) {
      collectOpFonts(child, used, metrics, emojiImageCache);
    }
  }
}

async function buildEmojiImageCache(
  mode: EmojiRenderMode,
  pages: PageLayout[],
  metrics: FontMetricsProvider,
  pdf: PDFDocument
): Promise<Map<string, EmbeddedPdfImage>> {
  const cache = new Map<string, EmbeddedPdfImage>();
  if (mode !== "imageCache" || typeof document === "undefined") {
    return cache;
  }

  const usage = collectEmojiUsage(pages, metrics);
  for (const [key, item] of usage) {
    const pngBytes = renderEmojiToPngBytes(item.grapheme, item.cssFamily, item.maxCellPt);
    if (!pngBytes) {
      continue;
    }
    try {
      const embedded = await pdf.embedPng(pngBytes);
      cache.set(key, embedded);
    } catch {
      // Skip image-cache mode for this grapheme if PNG embedding fails.
    }
  }

  return cache;
}

function collectEmojiUsage(
  pages: PageLayout[],
  metrics: FontMetricsProvider
): Map<string, EmojiUsage> {
  const usage = new Map<string, EmojiUsage>();
  for (const page of pages) {
    for (const op of page.ops) {
      collectEmojiUsageFromOp(op, usage, metrics);
    }
  }
  return usage;
}

function collectEmojiUsageFromOp(
  op: DrawOp,
  usage: Map<string, EmojiUsage>,
  metrics: FontMetricsProvider
): void {
  if (op.kind === "glyph") {
    recordEmojiUsage(op.char, op.fontId, op.fontSizePt, usage, metrics);
    return;
  }

  if (op.kind === "glyphRun") {
    for (const grapheme of splitGraphemes(op.text)) {
      recordEmojiUsage(grapheme, op.fontId, op.fontSizePt, usage, metrics);
    }
    return;
  }

  if (op.kind === "textSpan") {
    for (const child of op.ops) {
      collectEmojiUsageFromOp(child, usage, metrics);
    }
  }
}

function recordEmojiUsage(
  grapheme: string,
  fontId: string,
  fontSizePt: number,
  usage: Map<string, EmojiUsage>,
  metrics: FontMetricsProvider
): void {
  if (!shouldUseEmojiMetricsFallback(grapheme)) {
    return;
  }

  const resolvedFontId = metrics.resolveFontForChar(fontId, grapheme);
  const cssFamily = metrics.getCssFamily(resolvedFontId);
  const key = createEmojiCacheKey(grapheme, cssFamily);
  const glyph = metrics.getGlyphMetrics(fontId, grapheme, fontSizePt);
  const cellPt = Math.max(glyph.widthPt, glyph.ascentPt + glyph.descentPt, fontSizePt);
  const existing = usage.get(key);

  if (!existing) {
    usage.set(key, { grapheme, cssFamily, maxCellPt: cellPt });
    return;
  }

  existing.maxCellPt = Math.max(existing.maxCellPt, cellPt);
}

function resolveEmojiImage(
  grapheme: string,
  fontId: string,
  metrics: FontMetricsProvider,
  emojiImageCache: Map<string, EmbeddedPdfImage>
): EmbeddedPdfImage | null {
  if (!shouldUseEmojiMetricsFallback(grapheme) || emojiImageCache.size === 0) {
    return null;
  }

  const key = createEmojiCacheKey(grapheme, metrics.getCssFamily(fontId));
  return emojiImageCache.get(key) ?? null;
}

function createEmojiCacheKey(grapheme: string, cssFamily: string): string {
  return `${cssFamily}\u0000${grapheme}`;
}

function renderEmojiToPngBytes(
  grapheme: string,
  cssFamily: string,
  maxCellPt: number
): Uint8Array | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  const sizePx = clamp(
    Math.ceil(Math.max(1, maxCellPt) * EMOJI_IMAGE_PX_PER_PT),
    EMOJI_IMAGE_MIN_PX,
    EMOJI_IMAGE_MAX_PX
  );
  canvas.width = sizePx;
  canvas.height = sizePx;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const leftPadPx = Math.max(1, Math.round(sizePx * EMOJI_HORIZONTAL_PAD_LEFT_RATIO));
  const rightPadPx = Math.max(4, Math.round(sizePx * EMOJI_HORIZONTAL_PAD_RIGHT_RATIO));
  const verticalPadPx = Math.max(2, Math.round(sizePx * EMOJI_VERTICAL_PAD_RATIO));
  const drawBoxX = leftPadPx;
  const drawBoxY = verticalPadPx;
  const drawBoxW = Math.max(1, sizePx - leftPadPx - rightPadPx);
  const drawBoxH = Math.max(1, sizePx - verticalPadPx * 2);
  const fitMarginPx = Math.max(1, Math.round(sizePx * EMOJI_FIT_MARGIN_RATIO));
  const maxInkW = Math.max(1, drawBoxW - fitMarginPx * 2);
  const maxInkH = Math.max(1, drawBoxH - fitMarginPx * 2);

  let fontPx = Math.max(16, Math.floor(sizePx * 0.82));
  let glyph = measureEmojiGlyphBox(ctx, grapheme, cssFamily, fontPx);

  for (let i = 0; i < 2; i += 1) {
    const fitScale = Math.min(maxInkW / glyph.width, maxInkH / glyph.height, 1);
    if (fitScale >= 0.995) {
      break;
    }
    fontPx = Math.max(12, Math.floor(fontPx * fitScale * 0.98));
    glyph = measureEmojiGlyphBox(ctx, grapheme, cssFamily, fontPx);
  }

  const x = Math.round(drawBoxX + (drawBoxW - glyph.width) / 2 - glyph.left);
  const baseline = Math.round(drawBoxY + (drawBoxH - glyph.height) / 2 + glyph.ascent);

  ctx.fillText(grapheme, x, baseline);
  return decodePngDataUrl(canvas.toDataURL("image/png"));
}

function measureEmojiGlyphBox(
  ctx: CanvasRenderingContext2D,
  grapheme: string,
  cssFamily: string,
  fontPx: number
): { left: number; width: number; ascent: number; height: number } {
  ctx.font = `${fontPx}px "${cssFamily}"`;
  const measured = ctx.measureText(grapheme);
  const ascent = measured.actualBoundingBoxAscent || fontPx * 0.8;
  const descent = measured.actualBoundingBoxDescent || fontPx * 0.2;
  const left = measured.actualBoundingBoxLeft || 0;
  const right = measured.actualBoundingBoxRight || 0;
  const advanceWidth = measured.width || fontPx * 0.8;
  const inkWidth = left + right;
  const hasInkBounds = inkWidth > 0.5;
  const rightSafetyPx = Math.max(2, Math.round(fontPx * EMOJI_RIGHT_SAFETY_AT_EM));
  const blendedWidth = hasInkBounds
    ? inkWidth + (advanceWidth - inkWidth) * EMOJI_INK_ADVANCE_BLEND
    : advanceWidth;
  const width = Math.max(blendedWidth, inkWidth + rightSafetyPx);

  return {
    left,
    // Keep a small right-side safety buffer while avoiding oversized advance width.
    width: Math.max(1, width),
    ascent,
    height: Math.max(1, ascent + descent)
  };
}

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  const marker = "base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  try {
    const base64 = dataUrl.slice(markerIndex + marker.length);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

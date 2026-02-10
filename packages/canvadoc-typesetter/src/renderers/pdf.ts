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

  const embeddedFonts = new Map<string, Awaited<ReturnType<typeof pdf.embedFont>>>();
  const fallbackFont = await pdf.embedFont(StandardFonts.Helvetica);

  for (const fontId of metrics.getFontIds()) {
    const bytes = metrics.getFontBytes(fontId);
    if (bytes.byteLength === 0) {
      embeddedFonts.set(fontId, fallbackFont);
      continue;
    }
    try {
      const embedded = await pdf.embedFont(bytes, { subset: false });
      embeddedFonts.set(fontId, embedded);
    } catch {
      // Fall back to a standard PDF font when custom embedding fails.
      embeddedFonts.set(fontId, fallbackFont);
    }
  }

  for (const pageLayout of pages) {
    const page = pdf.addPage([pageLayout.widthPt, pageLayout.heightPt]);
    for (const op of pageLayout.ops) {
      drawOp(op, pageLayout.heightPt, page, embeddedFonts, metrics, pdf);
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
  embeddedFonts: Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>,
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
      embeddedFonts
    );
    return;
  }

  if (op.kind === "glyphRun") {
    if (op.xOffsetsPt && op.xOffsetsPt.length >= op.text.length) {
      for (let i = 0; i < op.text.length; i += 1) {
        drawGlyph(
          op.text[i],
          op.fontId,
          op.fontSizePt,
          op.xPt + op.xOffsetsPt[i],
          op.yBaselinePt,
          pageHeightPt,
          page,
          embeddedFonts
        );
      }
      return;
    }

    let x = op.xPt;
    for (const char of op.text) {
      drawGlyph(
        char,
        op.fontId,
        op.fontSizePt,
        x,
        op.yBaselinePt,
        pageHeightPt,
        page,
        embeddedFonts
      );
      x += metrics.getAdvanceWidth(op.fontId, char, op.fontSizePt);
    }
    return;
  }

  if (op.kind === "textSpan") {
    for (const child of op.ops) {
      drawOp(child, pageHeightPt, page, embeddedFonts, metrics, pdf);
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
  embeddedFonts: Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>
): void {
  const font = embeddedFonts.get(fontId);
  if (!font) {
    return;
  }
  // Layout uses y-down baseline coordinates, PDF uses y-up.
  // drawText anchors at baseline, so a direct axis flip is correct.
  const yPdf = pageHeightPt - yBaselinePt;

  page.drawText(char, {
    x: xPt,
    y: yPdf,
    size: fontSizePt,
    font,
    color: rgb(0, 0, 0)
  });
}

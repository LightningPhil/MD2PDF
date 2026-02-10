import { describe, expect, it } from "vitest";

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream
} from "pdf-lib";

import { FontMetricsProvider } from "./font-metrics";
import { createTypesetter } from "./index";
import { renderPagesToPdf } from "./renderers/pdf";
import type { DrawOp, PageLayout } from "./types";
import type { Typesetter } from "./types";

function createTestTypesetter(): Typesetter {
  const empty = new ArrayBuffer(0);
  return createTypesetter({
    page: {
      size: "A4",
      margin: "Medium"
    },
    typography: {
      baseFontSizePt: 11,
      lineHeight: 1.35,
      paragraphSpacingPt: 6,
      headingScale: { h1: 2, h2: 1.6, h3: 1.3 }
    },
    fonts: {
      text: { id: "text", source: empty, cssFamily: "Times New Roman" },
      math: { id: "math", source: empty, cssFamily: "Times New Roman" },
      mono: { id: "mono", source: empty, cssFamily: "Courier New" }
    }
  });
}

function decodeContentsStream(stream: PDFRawStream): string {
  const decoded = decodePDFRawStream(stream).decode();
  return new TextDecoder("latin1").decode(decoded);
}

describe("PDF renderer", () => {
  it("creates link annotations from link ops", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset(
      "This line contains a [link](https://example.com) for testing."
    );
    const pdfBytes = await typesetter.renderToPdf(result.pages, { title: "Test Export" });
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPages()[0];

    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    expect(annots).toBeDefined();
    expect(annots?.size() ?? 0).toBeGreaterThan(0);

    const annot = annots!.lookup(0, PDFDict);
    const action = annot.lookup(PDFName.of("A"), PDFDict);
    const uri = action.lookup(PDFName.of("URI"), PDFString).decodeText();
    expect(uri).toBe("https://example.com");
  });

  it("emits text drawing operators in page content streams", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset("Simple searchable text.");
    const pdfBytes = await typesetter.renderToPdf(result.pages);
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPages()[0];

    const contents = page.node.lookup(PDFName.of("Contents"));
    const streams: PDFRawStream[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) {
        streams.push(contents.lookup(i, PDFRawStream));
      }
    } else if (contents instanceof PDFRawStream) {
      streams.push(contents);
    }

    const decoded = streams.map((stream) => decodeContentsStream(stream)).join("\n");
    expect(decoded.includes(" Tj") || decoded.includes(" TJ")).toBe(true);
  });

  it("uses baseline y for glyphs and consistent y-down conversion for underlines", async () => {
    const metrics = new FontMetricsProvider([
      {
        id: "text",
        source: new ArrayBuffer(0),
        cssFamily: "Times New Roman"
      }
    ]);
    const baselineDownPt = 20;
    const underlineTopDownPt = baselineDownPt + 2;
    const pageHeightPt = 100;
    const pages: PageLayout[] = [
      {
        index: 0,
        widthPt: 100,
        heightPt: pageHeightPt,
        ops: [
          {
            kind: "glyph",
            char: "A",
            fontId: "text",
            fontSizePt: 10,
            xPt: 10,
            yBaselinePt: baselineDownPt
          },
          {
            kind: "underline",
            xPt: 10,
            yPt: underlineTopDownPt,
            wPt: 8,
            thicknessPt: 1
          }
        ] satisfies DrawOp[]
      }
    ];

    const pdfBytes = await renderPagesToPdf(pages, metrics);
    const pdf = await PDFDocument.load(pdfBytes);
    const page = pdf.getPages()[0];
    const contents = page.node.lookup(PDFName.of("Contents"));
    const streams: PDFRawStream[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) {
        streams.push(contents.lookup(i, PDFRawStream));
      }
    } else if (contents instanceof PDFRawStream) {
      streams.push(contents);
    }

    const decoded = streams.map((stream) => decodeContentsStream(stream)).join("\n");

    const tmMatch = decoded.match(
      /1\s+0\s+0\s+1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/
    );
    expect(tmMatch).toBeTruthy();
    const textYPdf = Number(tmMatch![2]);
    expect(textYPdf).toBeCloseTo(pageHeightPt - baselineDownPt, 3);

    const cmMatches = Array.from(
      decoded.matchAll(/1\s+0\s+0\s+1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+cm/g)
    );
    expect(cmMatches.length).toBeGreaterThan(0);
    const underlineYPdf = Number(cmMatches[0][2]);
    expect(underlineYPdf).toBeCloseTo(pageHeightPt - (underlineTopDownPt + 1), 3);
    expect(underlineYPdf).toBeLessThan(textYPdf);
  });
});

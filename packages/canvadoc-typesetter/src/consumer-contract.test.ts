import { describe, expect, it, vi } from "vitest";

import {
  CANVADOC_TYPESETTER_CAPABILITIES,
  CANVADOC_TYPESETTER_METADATA,
  CANVADOC_TYPESETTER_VERSION,
  createTypesetter,
  getCanvaDocTypesetterMetadata,
  loadFontSpecFromUrl,
  mmToPt,
  type DrawOp,
  type Typesetter
} from "./index";

function createConsumerTypesetter(): Typesetter {
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

function collectText(ops: DrawOp[]): string {
  return ops
    .map((op) => {
      if (op.kind === "glyph") {
        return op.char;
      }
      if (op.kind === "glyphRun") {
        return op.text;
      }
      if (op.kind === "textSpan") {
        return collectText(op.ops);
      }
      return "";
    })
    .join("");
}

describe("consumer contract smoke", () => {
  it("exports stable entrypoint symbols for integrators", () => {
    expect(typeof createTypesetter).toBe("function");
    expect(typeof loadFontSpecFromUrl).toBe("function");
    expect(typeof mmToPt).toBe("function");
    expect(typeof getCanvaDocTypesetterMetadata).toBe("function");
    expect(typeof CANVADOC_TYPESETTER_VERSION).toBe("string");
    expect(CANVADOC_TYPESETTER_CAPABILITIES.renderTargets).toEqual(["canvas", "pdf"]);
    expect(CANVADOC_TYPESETTER_CAPABILITIES.emojiSuppression).toBe(true);
    expect(CANVADOC_TYPESETTER_CAPABILITIES.pdfFontSubsetting).toBe(true);
    expect(CANVADOC_TYPESETTER_CAPABILITIES.pdfEmojiImageCache).toBe(true);
    expect(CANVADOC_TYPESETTER_METADATA.version).toBe(CANVADOC_TYPESETTER_VERSION);
  });

  it("returns the documented typeset result shape", async () => {
    const typesetter = createConsumerTypesetter();
    const result = await typesetter.typeset("# Title\n\nBody");

    expect(Array.isArray(result.pages)).toBe(true);
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.diagnostics.warnings).toBeInstanceOf(Array);
    expect(result.diagnostics.errors).toBeInstanceOf(Array);

    const firstPage = result.pages[0];
    expect(firstPage.index).toBe(0);
    expect(typeof firstPage.widthPt).toBe("number");
    expect(typeof firstPage.heightPt).toBe("number");
    expect(firstPage.ops.length).toBeGreaterThan(0);
  });

  it("renders pages through the canvas path", async () => {
    const typesetter = createConsumerTypesetter();
    const result = await typesetter.typeset("Canvas smoke.");

    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      textBaseline: "alphabetic" as CanvasTextBaseline,
      fillStyle: "#111" as string | CanvasGradient | CanvasPattern,
      strokeStyle: "#111" as string | CanvasGradient | CanvasPattern,
      font: ""
    } as unknown as CanvasRenderingContext2D;

    const getContextMock = vi.fn().mockReturnValue(ctx);
    const canvas = {
      width: 0,
      height: 0,
      style: { width: "", height: "" },
      getContext: getContextMock
    } as unknown as HTMLCanvasElement;

    typesetter.renderToCanvas(result.pages, canvas, {
      zoom: 1,
      pageGapPt: 20,
      background: "white",
      mode: "stackedPages"
    });

    expect(getContextMock).toHaveBeenCalledWith("2d");
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(ctx.setTransform).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("renders pages through the pdf path", async () => {
    const typesetter = createConsumerTypesetter();
    const result = await typesetter.typeset("PDF smoke.");
    const bytes = await typesetter.renderToPdf(result.pages, { title: "Consumer Smoke" });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it("keeps emoji text in the layout/render pipeline", async () => {
    const typesetter = createConsumerTypesetter();
    const result = await typesetter.typeset("Emoji path \u{1F600} \u{1F680}");
    const layoutText = result.pages.map((page) => collectText(page.ops)).join("");

    expect(layoutText).toContain("\u{1F600}");
    expect(layoutText).toContain("\u{1F680}");
    expect(CANVADOC_TYPESETTER_CAPABILITIES.emojiFallback).toBe("heuristicMetrics");
  });
});

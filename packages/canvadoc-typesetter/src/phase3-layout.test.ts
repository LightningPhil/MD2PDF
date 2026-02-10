import { describe, expect, it } from "vitest";

import { createTypesetter } from "./index";
import type { DrawOp, PageLayout, TypesetFeatureOptions, Typesetter } from "./types";

function createTestTypesetter(features?: TypesetFeatureOptions): Typesetter {
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
      mono: { id: "mono", source: empty, cssFamily: "Courier New" },
      fallback: [{ id: "fallback", source: empty, cssFamily: "Segoe UI Symbol" }]
    },
    features
  });
}

function collectOps(pages: PageLayout[]): DrawOp[] {
  return pages.flatMap((page) => page.ops);
}

function collectGlyphRuns(ops: DrawOp[]): Array<Extract<DrawOp, { kind: "glyphRun" }>> {
  const out: Array<Extract<DrawOp, { kind: "glyphRun" }>> = [];
  for (const op of ops) {
    if (op.kind === "glyphRun") {
      out.push(op);
      continue;
    }
    if (op.kind === "textSpan") {
      for (const child of op.ops) {
        if (child.kind === "glyphRun") {
          out.push(child);
        }
      }
    }
  }
  return out;
}

describe("phase 3 layout integration", () => {
  it("emits text spans and link rectangles for inline links", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset(
      "A paragraph with [one link](https://example.com) and another [link](https://openai.com)."
    );
    const ops = collectOps(result.pages);

    expect(ops.some((op) => op.kind === "textSpan")).toBe(true);
    expect(ops.some((op) => op.kind === "link")).toBe(true);
  });

  it("supports inline formatting in table cells", async () => {
    const typesetter = createTestTypesetter();
    const markdown = [
      "| Name | Notes |",
      "| --- | --- |",
      "| alpha | **bold** and $x^2$ plus [docs](https://example.com) |"
    ].join("\n");

    const result = await typesetter.typeset(markdown);
    const ops = collectOps(result.pages);

    expect(result.diagnostics.errors).toEqual([]);
    expect(ops.some((op) => op.kind === "textSpan")).toBe(true);
    expect(ops.some((op) => op.kind === "glyphRun")).toBe(true);
    expect(ops.some((op) => op.kind === "link")).toBe(true);
  });

  it("emits strikethrough ops and no link underline by default", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset("~~struck~~ and [linked](https://example.com)");
    const ops = collectOps(result.pages);

    expect(ops.some((op) => op.kind === "strikethrough")).toBe(true);
    expect(ops.some((op) => op.kind === "underline")).toBe(false);
  });

  it("can enable link underline explicitly", async () => {
    const typesetter = createTestTypesetter({
      typography: {
        linkUnderline: true
      }
    });
    const result = await typesetter.typeset("A [linked](https://example.com) fragment.");
    const ops = collectOps(result.pages);
    const underlines = ops.filter(
      (op): op is Extract<DrawOp, { kind: "underline" }> => op.kind === "underline"
    );
    const linkRuns = collectGlyphRuns(ops).filter((run) => run.text.includes("linked"));

    expect(underlines.length).toBeGreaterThan(0);
    expect(linkRuns.length).toBeGreaterThan(0);

    const baseline = linkRuns[0].yBaselinePt;
    const underlineCenter = underlines[0].yPt + underlines[0].thicknessPt / 2;
    expect(underlineCenter).toBeGreaterThan(baseline);
  });

  it("expands safe math macros without errors", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset(
      "Inline math: $\\newcommand{\\foo}{x^2+1} \\foo + y$"
    );
    const ops = collectOps(result.pages);

    expect(result.diagnostics.errors).toEqual([]);
    expect(ops.some((op) => op.kind === "glyphRun")).toBe(true);
  });

  it("emits explicit diagnostics for unsupported macro forms", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset(
      "Inline math: $\\newcommand{\\foo}[1]{#1^2} \\foo{x}$"
    );

    expect(result.diagnostics.errors.some((msg) => msg.includes("Unsupported: \\newcommand"))).toBe(
      true
    );
  });
});

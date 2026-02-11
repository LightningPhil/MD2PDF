import { describe, expect, it } from "vitest";

import { createTypesetter } from "./index";
import { splitGraphemes } from "./text/graphemes";
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

  it("keeps emoji grapheme clusters intact in glyph-run offsets", async () => {
    const typesetter = createTestTypesetter();
    const smile = "\u{1F600}";
    const thumbsTone = "\u{1F44D}\u{1F3FD}";
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
    const source = `Emoji line: ${smile} ${thumbsTone} ${family}`;
    const result = await typesetter.typeset(source);
    const runs = collectGlyphRuns(collectOps(result.pages));
    const combined = runs.map((run) => run.text).join("");

    expect(result.diagnostics.errors).toEqual([]);
    expect(combined).toContain(smile);
    expect(combined).toContain(thumbsTone);
    expect(combined).toContain(family);

    for (const run of runs) {
      if (!run.xOffsetsPt) {
        continue;
      }
      expect(run.xOffsetsPt.length).toBe(splitGraphemes(run.text).length);
    }
  });

  it("uses consistent full-width advances for legacy emoji symbols", async () => {
    const typesetter = createTestTypesetter();
    const lightning = "\u26A1";
    const sparkles = "\u2728";
    const result = await typesetter.typeset(`A${lightning}B${sparkles}C`);
    const runs = collectGlyphRuns(collectOps(result.pages));
    const run = runs.find((entry) => entry.text.includes(lightning) && entry.text.includes(sparkles));

    expect(run).toBeDefined();
    expect(run!.xOffsetsPt).toBeDefined();

    const graphemes = splitGraphemes(run!.text);
    const lightningIndex = graphemes.indexOf(lightning);
    const sparklesIndex = graphemes.indexOf(sparkles);
    expect(lightningIndex).toBeGreaterThanOrEqual(0);
    expect(sparklesIndex).toBeGreaterThanOrEqual(0);
    expect(lightningIndex).toBeLessThan(graphemes.length - 1);
    expect(sparklesIndex).toBeLessThan(graphemes.length - 1);

    const xOffsets = run!.xOffsetsPt!;
    const lightningAdvance = xOffsets[lightningIndex + 1] - xOffsets[lightningIndex];
    const sparklesAdvance = xOffsets[sparklesIndex + 1] - xOffsets[sparklesIndex];
    expect(lightningAdvance).toBeCloseTo(11, 3);
    expect(sparklesAdvance).toBeCloseTo(11, 3);
  });

  it("keeps explicit emoji-adjacent spaces at normal width", async () => {
    const typesetter = createTestTypesetter();
    const lightning = "\u26A1";
    const result = await typesetter.typeset(`${lightning} Energy`);
    const runs = collectGlyphRuns(collectOps(result.pages));

    const emojiRun = runs.find((entry) => entry.text.includes(lightning));
    expect(emojiRun).toBeDefined();

    const sameLineRuns = runs.filter(
      (entry) => Math.abs(entry.yBaselinePt - emojiRun!.yBaselinePt) < 0.01
    );
    const spaceRun = sameLineRuns.find(
      (entry) => entry.text.trim() === "" && entry.xPt > emojiRun!.xPt
    );
    expect(spaceRun).toBeDefined();

    const wordRun = sameLineRuns.find(
      (entry) => entry.text.startsWith("Energy") && entry.xPt > spaceRun!.xPt
    );
    expect(wordRun).toBeDefined();

    const spaceAdvance = wordRun!.xPt - spaceRun!.xPt;
    expect(spaceAdvance).toBeGreaterThan(2.5);
    expect(spaceAdvance).toBeLessThan(4.5);
  });

  it("does not inject a space after emoji when source has none", async () => {
    const typesetter = createTestTypesetter();
    const lightning = "\u26A1";
    const result = await typesetter.typeset(`${lightning}Energy`);
    const runs = collectGlyphRuns(collectOps(result.pages));
    const combined = runs.map((entry) => entry.text).join("");

    expect(combined).toContain(`${lightning}Energy`);
    expect(combined).not.toContain(`${lightning} Energy`);
  });

  it("uses full-width emoji advances when glyph metrics fall back", async () => {
    const typesetter = createTestTypesetter();
    const emoji = "\u{1F600}";
    const result = await typesetter.typeset(`A${emoji}B`);
    const runs = collectGlyphRuns(collectOps(result.pages));
    const run = runs.find((entry) => entry.text.includes(emoji));

    expect(run).toBeDefined();
    expect(run!.xOffsetsPt).toBeDefined();

    const graphemes = splitGraphemes(run!.text);
    const emojiIndex = graphemes.indexOf(emoji);
    expect(emojiIndex).toBeGreaterThanOrEqual(0);
    expect(emojiIndex).toBeLessThan(graphemes.length - 1);

    const xOffsets = run!.xOffsetsPt!;
    const emojiAdvance = xOffsets[emojiIndex + 1] - xOffsets[emojiIndex];
    expect(emojiAdvance).toBeCloseTo(11, 3);
  });
});

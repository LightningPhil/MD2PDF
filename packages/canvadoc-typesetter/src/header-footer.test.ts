import { describe, expect, it } from "vitest";

import { createTypesetter } from "./index";
import type { DrawOp, TypesetOptions, Typesetter } from "./types";

type TestOverrides = {
  page?: Partial<TypesetOptions["page"]>;
  headerFooter?: TypesetOptions["headerFooter"];
  typography?: Partial<TypesetOptions["typography"]>;
  fonts?: Partial<TypesetOptions["fonts"]>;
  features?: TypesetOptions["features"];
};

function createTestTypesetter(overrides?: TestOverrides): Typesetter {
  const empty = new ArrayBuffer(0);
  return createTypesetter({
    page: {
      size: overrides?.page?.size ?? "A4",
      margin: overrides?.page?.margin ?? "Medium"
    },
    headerFooter: {
      header: { left: "", center: "", right: "" },
      footer: { left: "", center: "", right: "" },
      fontSizePt: 10,
      skipFirstPage: false,
      showSeparator: false,
      ...overrides?.headerFooter
    },
    typography: {
      baseFontSizePt: 11,
      lineHeight: 1.35,
      paragraphSpacingPt: 6,
      headingScale: { h1: 2, h2: 1.6, h3: 1.3 },
      ...overrides?.typography
    },
    fonts: {
      text: { id: "text", source: empty, cssFamily: "Times New Roman" },
      math: { id: "math", source: empty, cssFamily: "Times New Roman" },
      mono: { id: "mono", source: empty, cssFamily: "Courier New" },
      fallback: [{ id: "fallback", source: empty, cssFamily: "Segoe UI Symbol" }],
      ...overrides?.fonts
    },
    features: {
      ...overrides?.features,
      typography: {
        linkUnderline: true,
        ...overrides?.features?.typography
      }
    }
  });
}

function collectOps(result: Awaited<ReturnType<Typesetter["typeset"]>>): DrawOp[] {
  return result.pages.flatMap((page) => page.ops);
}

describe("header/footer rendering", () => {
  it("renders inline markdown styles and links in header/footer content", async () => {
    const typesetter = createTestTypesetter({
      headerFooter: {
        header: {
          left: "**Doc** [site](https://example.com)"
        },
        footer: {
          center: "~~draft~~"
        }
      }
    });

    const result = await typesetter.typeset("Body text.");
    const ops = collectOps(result);

    expect(result.diagnostics.errors).toEqual([]);
    expect(ops.some((op) => op.kind === "link" && op.href === "https://example.com")).toBe(true);
    expect(ops.some((op) => op.kind === "underline")).toBe(true);
    expect(ops.some((op) => op.kind === "strikethrough")).toBe(true);
  });

  it("supports page counter format modifiers in placeholders", async () => {
    const typesetter = createTestTypesetter({
      page: {
        size: { widthPt: 260, heightPt: 220 },
        margin: { top: 26, right: 20, bottom: 26, left: 20 }
      },
      headerFooter: {
        header: {
          center: "[[{{pageNumber:roman}}/{{totalPages:pad2}}]]"
        }
      }
    });

    const markdown = Array.from(
      { length: 120 },
      (_value, index) => `Paragraph ${index + 1} with enough text to force pagination.`
    ).join("\n\n");

    const result = await typesetter.typeset(markdown);
    expect(result.pages.length).toBeGreaterThan(1);

    const paddedTotal = String(result.pages.length).padStart(2, "0");
    for (let pageIndex = 0; pageIndex < result.pages.length; pageIndex += 1) {
      const marker = `[[${toRoman(pageIndex + 1)}/${paddedTotal}]]`;
      const glyphTexts = result.pages[pageIndex].ops
        .filter((op): op is Extract<DrawOp, { kind: "glyphRun" }> => op.kind === "glyphRun")
        .map((op) => op.text);
      expect(glyphTexts.some((text) => text.includes(marker))).toBe(true);
    }
  });

  it("clamps unsafe header/footer positions and emits diagnostics warnings", async () => {
    const typesetter = createTestTypesetter({
      headerFooter: {
        header: {
          left: "HEADER_CLAMP"
        },
        footer: {
          right: "FOOTER_CLAMP"
        },
        showSeparator: true,
        headerMarginPt: 500,
        footerMarginPt: -100
      }
    });

    const result = await typesetter.typeset("Single paragraph.");
    expect(result.diagnostics.warnings.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.warnings.some((message) => message.includes("baseline was clamped"))
    ).toBe(true);

    const firstPage = result.pages[0];
    const headerRun = firstPage.ops.find(
      (op): op is Extract<DrawOp, { kind: "glyphRun" }> =>
        op.kind === "glyphRun" && op.text.includes("HEADER_CLAMP")
    );
    const footerRun = firstPage.ops.find(
      (op): op is Extract<DrawOp, { kind: "glyphRun" }> =>
        op.kind === "glyphRun" && op.text.includes("FOOTER_CLAMP")
    );
    const rules = firstPage.ops.filter(
      (op): op is Extract<DrawOp, { kind: "rule" }> => op.kind === "rule"
    );

    expect(headerRun).toBeDefined();
    expect(footerRun).toBeDefined();
    expect(rules.length).toBeGreaterThanOrEqual(2);

    const contentTop = 72;
    const contentBottom = firstPage.heightPt - 72;
    expect(headerRun!.yBaselinePt).toBeLessThan(contentTop);
    expect(footerRun!.yBaselinePt).toBeGreaterThan(contentBottom);
    expect(rules.some((rule) => rule.yPt < contentTop)).toBe(true);
    expect(rules.some((rule) => rule.yPt >= contentBottom)).toBe(true);
  });
});

function toRoman(value: number): string {
  const map: Array<{ value: number; token: string }> = [
    { value: 1000, token: "M" },
    { value: 900, token: "CM" },
    { value: 500, token: "D" },
    { value: 400, token: "CD" },
    { value: 100, token: "C" },
    { value: 90, token: "XC" },
    { value: 50, token: "L" },
    { value: 40, token: "XL" },
    { value: 10, token: "X" },
    { value: 9, token: "IX" },
    { value: 5, token: "V" },
    { value: 4, token: "IV" },
    { value: 1, token: "I" }
  ];

  let remaining = value;
  let out = "";
  for (const entry of map) {
    while (remaining >= entry.value) {
      out += entry.token;
      remaining -= entry.value;
    }
    if (remaining === 0) {
      break;
    }
  }
  return out;
}

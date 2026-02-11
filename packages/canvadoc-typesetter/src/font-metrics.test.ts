import { describe, expect, it } from "vitest";

import { FontMetricsProvider } from "./font-metrics";

function createMetrics(): FontMetricsProvider {
  return new FontMetricsProvider([
    {
      id: "text",
      source: new ArrayBuffer(0),
      cssFamily: "Libertinus Serif"
    }
  ]);
}

describe("FontMetricsProvider emoji spacing", () => {
  it("treats legacy emoji symbols as full-width cells", () => {
    const metrics = createMetrics();
    const fontSizePt = 12;

    const lightning = "\u26A1";
    const sparkles = "\u2728";
    expect(metrics.getAdvanceWidth("text", lightning, fontSizePt)).toBeCloseTo(fontSizePt, 3);
    expect(metrics.getAdvanceWidth("text", sparkles, fontSizePt)).toBeCloseTo(fontSizePt, 3);
  });

  it("uses a full emoji box width when the current font lacks emoji glyphs", () => {
    const metrics = createMetrics();
    const fontSizePt = 12;
    const smile = "\u{1F600}";

    expect(metrics.canDisplayChar("text", smile)).toBe(false);

    const glyph = metrics.getGlyphMetrics("text", smile, fontSizePt);
    expect(glyph.widthPt).toBeCloseTo(fontSizePt, 3);
    expect(glyph.ascentPt).toBeGreaterThan(fontSizePt * 0.8);
    expect(glyph.descentPt).toBeGreaterThan(fontSizePt * 0.1);
  });

  it("keeps joined emoji sequences at a stable single-emoji advance", () => {
    const metrics = createMetrics();
    const fontSizePt = 12;
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";

    expect(metrics.canDisplayChar("text", family)).toBe(false);
    expect(metrics.getAdvanceWidth("text", family, fontSizePt)).toBeCloseTo(fontSizePt, 3);
  });

  it("applies emoji fallback width inside mixed text", () => {
    const metrics = createMetrics();
    const fontSizePt = 12;
    const plain = metrics.getTextWidth("text", "AA", fontSizePt);
    const withEmoji = metrics.getTextWidth("text", "A\u{1F600}A", fontSizePt);

    expect(withEmoji - plain).toBeCloseTo(fontSizePt, 3);
  });
});

import { describe, expect, it } from "vitest";

import { getRenderableGraphemeParts, shouldUseEmojiMetricsFallback } from "./emoji";

describe("shouldUseEmojiMetricsFallback", () => {
  it("detects supplementary-plane emoji graphemes", () => {
    expect(shouldUseEmojiMetricsFallback("\u{1F600}")).toBe(true);
    expect(shouldUseEmojiMetricsFallback("\u{1F680}")).toBe(true);
  });

  it("detects legacy emoji-style symbols in BMP blocks", () => {
    expect(shouldUseEmojiMetricsFallback("\u26A1")).toBe(true); // lightning
    expect(shouldUseEmojiMetricsFallback("\u2728")).toBe(true); // sparkles
  });

  it("detects variation-selector and joiner emoji sequences", () => {
    const hammerAndWrench = "\u{1F6E0}\uFE0F";
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
    expect(shouldUseEmojiMetricsFallback(hammerAndWrench)).toBe(true);
    expect(shouldUseEmojiMetricsFallback(family)).toBe(true);
  });

  it("detects flag graphemes built from regional indicators", () => {
    expect(shouldUseEmojiMetricsFallback("\u{1F1E9}\u{1F1EA}")).toBe(true);
  });

  it("does not treat plain text as emoji", () => {
    expect(shouldUseEmojiMetricsFallback("A")).toBe(false);
    expect(shouldUseEmojiMetricsFallback("hello")).toBe(false);
  });
});

describe("getRenderableGraphemeParts", () => {
  it("strips shaping controls and preserves renderable parts", () => {
    expect(getRenderableGraphemeParts("\u{1F6E0}\uFE0F")).toEqual(["\u{1F6E0}"]);
    expect(getRenderableGraphemeParts("1\uFE0F\u20E3")).toEqual(["1"]);
  });

  it("removes joiners from family sequences", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
    expect(getRenderableGraphemeParts(family)).toEqual([
      "\u{1F468}",
      "\u{1F469}",
      "\u{1F467}",
      "\u{1F466}"
    ]);
  });
});

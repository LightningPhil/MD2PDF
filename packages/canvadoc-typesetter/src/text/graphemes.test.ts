import { describe, expect, it } from "vitest";

import { splitGraphemes } from "./graphemes";

describe("splitGraphemes", () => {
  it("keeps surrogate-pair emoji intact", () => {
    const smile = "\u{1F600}";
    expect(splitGraphemes(`A${smile}B`)).toEqual(["A", smile, "B"]);
  });

  it("keeps joined emoji intact when Intl.Segmenter is available", () => {
    const intl = Intl as unknown as { Segmenter?: unknown };
    if (typeof intl.Segmenter !== "function") {
      return;
    }

    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
    const thumbsTone = "\u{1F44D}\u{1F3FD}";
    expect(splitGraphemes(family)).toEqual([family]);
    expect(splitGraphemes(thumbsTone)).toEqual([thumbsTone]);
  });
});

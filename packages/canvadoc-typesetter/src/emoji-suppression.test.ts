import { describe, expect, it } from "vitest";

import { createTypesetter } from "./index";
import type { DrawOp, Typesetter } from "./types";

function createTestTypesetter(options?: {
  emojiMode?: "preserve" | "suppress";
  replacement?: string;
}): Typesetter {
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
    },
    features: {
      emoji: {
        mode: options?.emojiMode,
        replacement: options?.replacement
      }
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

describe("emoji suppression", () => {
  it("preserves emoji by default", async () => {
    const typesetter = createTestTypesetter();
    const result = await typesetter.typeset("A \u{1F600} B");
    const text = result.pages.map((page) => collectText(page.ops)).join("");

    expect(text).toContain("\u{1F600}");
  });

  it("replaces emoji with default marker when suppression is enabled", async () => {
    const typesetter = createTestTypesetter({ emojiMode: "suppress" });
    const result = await typesetter.typeset("A \u{1F600} B");
    const text = result.pages.map((page) => collectText(page.ops)).join("");

    expect(text).toContain("~");
    expect(text).not.toContain("\u{1F600}");
  });

  it("uses custom replacement for suppressed emoji", async () => {
    const typesetter = createTestTypesetter({
      emojiMode: "suppress",
      replacement: "[emoji]"
    });
    const result = await typesetter.typeset("Launch \u{1F680}");
    const text = result.pages.map((page) => collectText(page.ops)).join("");

    expect(text).toContain("[emoji]");
    expect(text).not.toContain("\u{1F680}");
  });
});

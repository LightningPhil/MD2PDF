import { describe, expect, it } from "vitest";

import { parseInlineNodes } from "./inline-parser";

describe("parseInlineNodes", () => {
  it("parses emphasis, strong, and strike styles", () => {
    const nodes = parseInlineNodes("a *b* **c** ~~d~~");
    expect(nodes).toEqual([
      { kind: "text", text: "a " },
      { kind: "text", text: "b", style: { italic: true } },
      { kind: "text", text: " " },
      { kind: "text", text: "c", style: { bold: true } },
      { kind: "text", text: " " },
      { kind: "text", text: "d", style: { strike: true } }
    ]);
  });

  it("supports nested inline styles", () => {
    const nodes = parseInlineNodes("**mix *inner* text**");
    expect(nodes).toEqual([
      { kind: "text", text: "mix ", style: { bold: true } },
      { kind: "text", text: "inner", style: { bold: true, italic: true } },
      { kind: "text", text: " text", style: { bold: true } }
    ]);
  });

  it("parses markdown links and autolinks", () => {
    const nodes = parseInlineNodes("[docs](https://example.com) <https://example.org>");
    expect(nodes).toEqual([
      { kind: "text", text: "docs", style: { href: "https://example.com" } },
      { kind: "text", text: " " },
      { kind: "text", text: "https://example.org", style: { href: "https://example.org" } }
    ]);
  });

  it("emits explicit line break nodes for hard breaks", () => {
    const nodes = parseInlineNodes("line one\nline two");
    expect(nodes).toEqual([
      { kind: "text", text: "line one" },
      { kind: "lineBreak" },
      { kind: "text", text: "line two" }
    ]);
  });

  it("preserves style context for inline code and math", () => {
    const nodes = parseInlineNodes("**`x` + $y$**");
    expect(nodes).toEqual([
      { kind: "code", code: "x", style: { bold: true } },
      { kind: "text", text: " + ", style: { bold: true } },
      { kind: "math", expr: "y", style: { bold: true } }
    ]);
  });
});

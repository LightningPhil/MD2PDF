import { describe, expect, it } from "vitest";

import { expandMathMacros } from "./macros";

describe("expandMathMacros", () => {
  it("expands a simple macro definition", () => {
    const input = "\\newcommand{\\foo}{x^2+1} \\foo + y";
    expect(expandMathMacros(input)).toBe(" x^2+1 + y");
  });

  it("expands nested macro references deterministically", () => {
    const input = "\\newcommand{\\a}{x}\\newcommand{\\b}{\\a+\\a}\\b";
    expect(expandMathMacros(input)).toBe("x+x");
  });

  it("throws for parameterized newcommand usage", () => {
    const input = "\\newcommand{\\foo}[1]{#1^2}\\foo{x}";
    expect(() => expandMathMacros(input)).toThrow("Unsupported: \\newcommand with parameters");
  });

  it("throws on recursive macro definitions", () => {
    const input = "\\newcommand{\\foo}{\\foo}\\foo";
    expect(() => expandMathMacros(input)).toThrow("Recursive macro detected");
  });

  it("enforces output size limits", () => {
    const input = "\\newcommand{\\x}{abcdefghij}\\x\\x\\x";
    expect(() => expandMathMacros(input, { maxOutputLength: 8 })).toThrow(
      "Macro expansion exceeded maximum output length"
    );
  });
});

/**
 * LaTeX-like math parser.
 *
 * Purpose:
 * - Parse supported math syntax into the MathNode AST consumed by layout.
 * - Keep parsing deterministic and explicit for unsupported constructs.
 *
 * Usage:
 * - Invoked by layoutMathExpression after macro expansion.
 * - Errors are surfaced as diagnostics by the document layout engine.
 */
import type { MathNode } from "./ast";

const COMMAND_SYMBOLS: Record<string, string> = {
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03F5",
  varepsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  vartheta: "\u03D1",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  pi: "\u03C0",
  varpi: "\u03D6",
  rho: "\u03C1",
  varrho: "\u03F1",
  sigma: "\u03C3",
  varsigma: "\u03C2",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03D5",
  varphi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Xi: "\u039E",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Upsilon: "\u03A5",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9",
  pm: "\u00B1",
  mp: "\u2213",
  cdot: "\u00B7",
  times: "\u00D7",
  div: "\u00F7",
  neq: "\u2260",
  approx: "\u2248",
  sim: "\u223C",
  simeq: "\u2243",
  cong: "\u2245",
  propto: "\u221D",
  le: "\u2264",
  ge: "\u2265",
  ll: "\u226A",
  gg: "\u226B",
  leqslant: "\u2A7D",
  geqslant: "\u2A7E",
  land: "\u2227",
  lor: "\u2228",
  lnot: "\u00AC",
  forall: "\u2200",
  exists: "\u2203",
  implies: "\u21D2",
  iff: "\u21D4",
  in: "\u2208",
  notin: "\u2209",
  subset: "\u2282",
  subseteq: "\u2286",
  supset: "\u2283",
  supseteq: "\u2287",
  cup: "\u222A",
  cap: "\u2229",
  setminus: "\u2216",
  emptyset: "\u2205",
  nabla: "\u2207",
  partial: "\u2202",
  infty: "\u221E",
  to: "\u2192",
  rightarrow: "\u2192",
  leftarrow: "\u2190",
  leftrightarrow: "\u2194",
  Rightarrow: "\u21D2",
  Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4",
  mapsto: "\u21A6",
  uparrow: "\u2191",
  downarrow: "\u2193",
  angle: "\u2220",
  deg: "\u00B0",
  circ: "\u2218",
  perp: "\u27C2",
  parallel: "\u2225",
  ell: "\u2113",
  cdots: "\u22EF",
  ldots: "\u2026",
  vdots: "\u22EE",
  ddots: "\u22F1",
  sum: "\u2211",
  prod: "\u220F",
  coprod: "\u2210",
  bigcup: "\u22C3",
  bigcap: "\u22C2",
  int: "\u222B",
  iint: "\u222C",
  iiint: "\u222D",
  oint: "\u222E",
  lim: "lim",
  langle: "\u27E8",
  rangle: "\u27E9",
  vert: "|",
  Vert: "\u2016"
};

const STYLE_COMMANDS = new Set([
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathbb",
  "mathcal"
]);

const SPACING_COMMANDS: Record<string, Extract<MathNode, { kind: "space" }>['amount']> = {
  ",": "thin",
  ":": "medium",
  ";": "thick",
  quad: "quad",
  qquad: "qquad"
};

const OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "=",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ".",
  ";",
  ":",
  "<",
  ">",
  "|"
]);

/**
 * Parse a LaTeX-style math expression into an AST.
 *
 * Supported syntax:
 * - Greek letters: \alpha, \beta, \gamma, \Gamma, \Delta, etc.
 * - Operators: \pm, \times, \cdot, \le, \ge, \neq, \approx, etc.
 * - Arrows: \to, \rightarrow, \Rightarrow, \mapsto, etc.
 * - Logic: \forall, \exists, \land, \lor, \implies, etc.
 * - Sets: \in, \subset, \cup, \cap, \emptyset, etc.
 * - Big operators: \sum, \prod, \int, \bigcup, etc.
 * - Fractions: \frac{num}{denom}, \dfrac, \tfrac
 * - Roots: \sqrt{expr}, \sqrt[n]{expr}
 * - Superscripts/subscripts: x^2, x_i, x_i^2
 * - Grouping: {group}
 * - Delimiters: \left( ... \right), \left[ ... \right], etc.
 * - Environments: \begin{matrix}...\end{matrix}, \begin{aligned}...\end{aligned}, etc.
 * - Styles: \mathrm, \mathbf, \mathbb, \mathcal, etc.
 * - Spacing: \,, \:, \;, \quad, \qquad
 * - Text: \text{...}
 *
 * @param input - LaTeX-style math expression
 * @returns Parsed MathNode AST
 * @throws Error if the input contains invalid syntax
 *
 * @example
 * ```typescript
 * const ast = parseMath('\\frac{x^2}{y}');
 * // Returns: { kind: "fraction", numerator: ..., denominator: ... }
 * ```
 */
export function parseMath(input: string): MathNode {
  const parser = new MathParser(input);
  const node = parser.parseRow();
  parser.skipWhitespace();
  if (!parser.isDone()) {
    throw new Error(`Unexpected token at position ${parser.position()}`);
  }
  return node;
}

class MathParser {
  private idx = 0;

  constructor(private readonly src: string) {}

  position(): number {
    return this.idx;
  }

  isDone(): boolean {
    return this.idx >= this.src.length;
  }

  parseRow(stop?: () => boolean): MathNode {
    const children: MathNode[] = [];
    while (!this.isDone()) {
      this.skipWhitespace();
      if (this.isDone()) {
        break;
      }
      if (stop?.()) {
        break;
      }

      const atom = this.parseAtom();
      children.push(this.parseSupSubIfPresent(atom));
    }
    return children.length === 1 ? children[0] : { kind: "row", children };
  }

  skipWhitespace(): void {
    while (!this.isDone() && /\s/.test(this.peek())) {
      this.idx += 1;
    }
  }

  private parseAtom(): MathNode {
    const ch = this.peek();

    if (ch === "{") {
      this.consume("{");
      const node = this.parseRow(() => this.peek() === "}");
      this.consume("}");
      return node;
    }

    if (ch === "\\") {
      this.consume("\\");
      const command = this.readCommandToken();
      if (!command) {
        throw new Error(`Expected command name at position ${this.idx}`);
      }
      if (command === "frac" || command === "dfrac" || command === "tfrac") {
        const numerator = this.parseRequiredGroup();
        const denominator = this.parseRequiredGroup();
        return { kind: "fraction", numerator, denominator };
      }
      if (command === "binom") {
        const upper = this.parseRequiredGroup();
        const lower = this.parseRequiredGroup();
        return { kind: "binom", upper, lower };
      }
      if (command === "overset" || command === "underset" || command === "stackrel") {
        const annotation = this.parseRequiredGroup();
        const base = this.parseRequiredGroup();
        if (command === "underset") {
          return { kind: "overunder", base, under: annotation };
        }
        return { kind: "overunder", base, over: annotation };
      }
      if (command === "sqrt") {
        const degree = this.parseOptionalBracketGroup();
        const body = this.parseRequiredGroup();
        return { kind: "sqrt", body, degree };
      }
      if (command === "begin") {
        // Environment bodies are parsed as raw text and laid out by specialized handlers.
        const envName = this.parseRequiredRawGroup().trim();
        const body = this.readEnvironmentBody(envName);
        return { kind: "environment", name: envName, body };
      }
      if (command === "left") {
        return this.parseDelimited();
      }
      if (command === "text") {
        return { kind: "text", value: this.parseRequiredRawGroup() };
      }
      if (command === "operatorname") {
        return { kind: "operatorname", name: this.parseRequiredRawGroup().trim() };
      }
      if (command === "bar" || command === "overline") {
        const body = this.parseRequiredGroup();
        return {
          kind: "row",
          children: [{ kind: "symbol", value: "\u00AF" }, body]
        };
      }
      if (command === "hat" || command === "widehat") {
        const body = this.parseRequiredGroup();
        return {
          kind: "row",
          children: [{ kind: "symbol", value: "^" }, body]
        };
      }
      if (command === "vec") {
        const body = this.parseRequiredGroup();
        return {
          kind: "row",
          children: [{ kind: "symbol", value: "\u2192" }, body]
        };
      }
      if (STYLE_COMMANDS.has(command)) {
        const body = this.parseRequiredGroup();
        return {
          kind: "style",
          style: command as Extract<MathNode, { kind: "style" }>['style'],
          body
        };
      }
      if (command in SPACING_COMMANDS) {
        return { kind: "space", amount: SPACING_COMMANDS[command] };
      }
      if (command === "\\") {
        return { kind: "space", amount: "quad" };
      }
      const symbol = COMMAND_SYMBOLS[command];
      if (symbol) {
        return { kind: "symbol", value: symbol };
      }
      return { kind: "symbol", value: `\\${command}` };
    }

    if (/[A-Za-z0-9]/.test(ch) || OPERATORS.has(ch)) {
      this.idx += 1;
      return { kind: "symbol", value: ch };
    }

    if (ch) {
      this.idx += 1;
      return { kind: "symbol", value: ch };
    }

    throw new Error(`Unexpected character '${ch}' at position ${this.idx}`);
  }

  private parseRequiredGroup(): MathNode {
    this.skipWhitespace();
    if (this.peek() !== "{") {
      throw new Error(`Expected '{' at position ${this.idx}`);
    }
    this.consume("{");
    const node = this.parseRow(() => this.peek() === "}");
    this.consume("}");
    return node;
  }

  private parseOptionalBracketGroup(): MathNode | undefined {
    this.skipWhitespace();
    if (this.peek() !== "[") {
      return undefined;
    }
    this.consume("[");
    const node = this.parseRow(() => this.peek() === "]");
    this.consume("]");
    return node;
  }

  private parseRequiredRawGroup(): string {
    return this.parseRawGroup("{", "}");
  }

  private parseRawGroup(open: string, close: string): string {
    this.skipWhitespace();
    if (this.peek() !== open) {
      throw new Error(`Expected '${open}' at position ${this.idx}`);
    }
    this.consume(open);
    const start = this.idx;
    let depth = 1;

    while (!this.isDone()) {
      const ch = this.peek();
      if (ch === "\\") {
        this.idx += Math.min(2, this.src.length - this.idx);
        continue;
      }
      if (ch === open) {
        depth += 1;
      } else if (ch === close) {
        depth -= 1;
      }
      this.idx += 1;
      if (depth === 0) {
        return this.src.slice(start, this.idx - 1);
      }
    }

    throw new Error(`Unterminated '${open}...${close}' group`);
  }

  private parseDelimited(): MathNode {
    const left = this.parseDelimiterToken();
    const body = this.parseRow(() => this.isCommandAhead("right"));
    this.skipWhitespace();
    this.consume("\\");
    const command = this.readCommandToken();
    if (command !== "right") {
      throw new Error(`Expected \\right at position ${this.idx}`);
    }
    const right = this.parseDelimiterToken();
    return { kind: "delimited", left, right, body };
  }

  private parseDelimiterToken(): string {
    this.skipWhitespace();
    if (this.isDone()) {
      return "";
    }
    if (this.peek() === "\\") {
      this.consume("\\");
      const command = this.readCommandToken();
      if (command === ".") {
        return "";
      }
      if (command === "{") {
        return "{";
      }
      if (command === "}") {
        return "}";
      }
      if (command === "|") {
        return "\u2016";
      }
      return COMMAND_SYMBOLS[command] ?? command;
    }
    const char = this.peek();
    this.idx += 1;
    return char === "." ? "" : char;
  }

  private readEnvironmentBody(envName: string): string {
    const beginToken = `\\begin{${envName}}`;
    const endToken = `\\end{${envName}}`;
    const bodyStart = this.idx;
    let cursor = this.idx;
    let depth = 1;

    while (cursor < this.src.length) {
      const nextBegin = this.src.indexOf(beginToken, cursor);
      const nextEnd = this.src.indexOf(endToken, cursor);
      if (nextEnd === -1) {
        break;
      }
      if (nextBegin !== -1 && nextBegin < nextEnd) {
        depth += 1;
        cursor = nextBegin + beginToken.length;
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        const body = this.src.slice(bodyStart, nextEnd);
        this.idx = nextEnd + endToken.length;
        return body.trim();
      }
      cursor = nextEnd + endToken.length;
    }

    throw new Error(`Missing \\end{${envName}} for environment`);
  }

  private parseScriptArgument(): MathNode {
    this.skipWhitespace();
    if (this.peek() === "{") {
      return this.parseRequiredGroup();
    }
    return this.parseAtom();
  }

  private parseSupSubIfPresent(base: MathNode): MathNode {
    this.skipWhitespace();
    let sup: MathNode | undefined;
    let sub: MathNode | undefined;

    while (!this.isDone()) {
      const ch = this.peek();
      if (ch !== "^" && ch !== "_") {
        break;
      }
      this.idx += 1;
      if (ch === "^") {
        sup = this.parseScriptArgument();
      } else {
        sub = this.parseScriptArgument();
      }
      this.skipWhitespace();
    }

    if (!sup && !sub) {
      return base;
    }
    return { kind: "supsub", base, sup, sub };
  }

  private readCommandToken(): string {
    if (this.isDone()) {
      return "";
    }
    const start = this.idx;
    if (/[A-Za-z]/.test(this.peek())) {
      while (!this.isDone() && /[A-Za-z]/.test(this.peek())) {
        this.idx += 1;
      }
      return this.src.slice(start, this.idx);
    }
    this.idx += 1;
    return this.src.slice(start, this.idx);
  }

  private isCommandAhead(commandName: string): boolean {
    let cursor = this.idx;
    while (cursor < this.src.length && /\s/.test(this.src[cursor])) {
      cursor += 1;
    }
    if (this.src[cursor] !== "\\") {
      return false;
    }
    cursor += 1;

    let name = "";
    if (/[A-Za-z]/.test(this.src[cursor] ?? "")) {
      while (cursor < this.src.length && /[A-Za-z]/.test(this.src[cursor])) {
        name += this.src[cursor];
        cursor += 1;
      }
    } else if (cursor < this.src.length) {
      name = this.src[cursor];
    }

    return name === commandName;
  }

  private consume(expected: string): void {
    if (this.peek() !== expected) {
      throw new Error(`Expected '${expected}' at position ${this.idx}`);
    }
    this.idx += 1;
  }

  private peek(): string {
    return this.src[this.idx] ?? "";
  }
}


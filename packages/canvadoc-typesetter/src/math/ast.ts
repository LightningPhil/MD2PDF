/**
 * Abstract Syntax Tree node types for parsed math expressions.
 *
 * The math parser produces an AST that represents the structure of LaTeX-style
 * math expressions. This AST is then processed by the math layout engine to
 * produce drawing operations.
 *
 * Node types:
 * - `row`: Horizontal sequence of nodes
 * - `symbol`: Single character or command (letters, numbers, operators, Greek letters)
 * - `fraction`: Numerator over denominator (\frac{}{})
 * - `sqrt`: Square root or nth root (\sqrt{} or \sqrt[n]{})
 * - `supsub`: Base with superscript and/or subscript (x^2, x_i, x_i^2)
 * - `space`: Horizontal spacing (\,, \:, \;, \quad, \qquad)
 * - `style`: Text style command (\mathrm, \mathbb, etc.)
 * - `text`: Plain text in math (\text{})
 * - `environment`: LaTeX environment (\begin{}...\end{})
 * - `delimited`: Content with scaling delimiters (\left...\right)
 * - `binom`: Binomial coefficient (\binom{n}{k})
 * - `overunder`: Explicit over/under annotations (\overset, \underset, \stackrel)
 * - `operatorname`: Text operator name (\operatorname{foo})
 */
export type MathNode =
  | { kind: "row"; children: MathNode[] }
  | { kind: "symbol"; value: string }
  | { kind: "fraction"; numerator: MathNode; denominator: MathNode }
  | { kind: "sqrt"; body: MathNode; degree?: MathNode }
  | { kind: "supsub"; base: MathNode; sup?: MathNode; sub?: MathNode }
  | { kind: "space"; amount: "thin" | "medium" | "thick" | "quad" | "qquad" }
  | {
      kind: "style";
      style:
        | "mathrm"
        | "mathbf"
        | "mathit"
        | "mathsf"
        | "mathtt"
        | "mathbb"
        | "mathcal";
      body: MathNode;
    }
  | { kind: "text"; value: string }
  | { kind: "environment"; name: string; body: string }
  | { kind: "delimited"; left: string; right: string; body: MathNode }
  | { kind: "binom"; upper: MathNode; lower: MathNode }
  | { kind: "overunder"; base: MathNode; over?: MathNode; under?: MathNode }
  | { kind: "operatorname"; name: string };

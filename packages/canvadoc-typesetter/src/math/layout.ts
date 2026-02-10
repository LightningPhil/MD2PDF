/**
 * Math layout engine.
 *
 * Purpose:
 * - Convert parsed math AST (MathNode) into deterministic MathBox geometry.
 * - Emit draw operations for symbols, rules, delimiters, scripts, and environments.
 *
 * Usage:
 * - Called by inline/display math layout in layout/engine.ts.
 * - Renderers consume emitted ops verbatim; this module owns math geometry.
 */
import type { DrawOp, GlyphRunOp, RuleOp } from "../types";
import { FontMetricsProvider } from "../font-metrics";
import type { MathNode } from "./ast";
import { expandMathMacros } from "./macros";
import { parseMath } from "./parser";

const SPACED_OPERATOR_SYMBOLS = new Set([
  "+",
  "-",
  "=",
  "<",
  ">",
  "\u00B1",
  "\u2213",
  "\u00D7",
  "\u00F7",
  "\u223C",
  "\u2248",
  "\u2243",
  "\u2245",
  "\u221D",
  "\u2264",
  "\u2265",
  "\u226A",
  "\u226B",
  "\u2A7D",
  "\u2A7E",
  "\u2208",
  "\u2209",
  "\u2282",
  "\u2286",
  "\u2283",
  "\u2287",
  "\u222A",
  "\u2229",
  "\u2216",
  "\u2227",
  "\u2228",
  "\u21D2",
  "\u21D4",
  "\u2192",
  "\u2190",
  "\u2194",
  "\u21A6"
]);

const BIG_OPERATOR_SYMBOLS = new Set([
  "\u2211",
  "\u220F",
  "\u2210",
  "\u22C3",
  "\u22C2",
  "\u222B",
  "\u222C",
  "\u222D",
  "\u222E",
  "lim"
]);

const MATHBB_CHAR_MAP: Record<string, string> = {
  R: "\u211D",
  C: "\u2102",
  Z: "\u2124",
  N: "\u2115",
  Q: "\u211A"
};

const MATHCAL_CHAR_MAP: Record<string, string> = {
  A: "\u{1D49C}",
  B: "\u212C",
  C: "\u{1D49E}",
  D: "\u{1D49F}",
  E: "\u2130",
  F: "\u2131",
  G: "\u{1D4A2}",
  H: "\u210B",
  I: "\u2110",
  J: "\u{1D4A5}",
  K: "\u{1D4A6}",
  L: "\u2112",
  M: "\u2133",
  N: "\u{1D4A9}",
  O: "\u{1D4AA}",
  P: "\u{1D4AB}",
  Q: "\u{1D4AC}",
  R: "\u211B",
  S: "\u{1D4AE}",
  T: "\u{1D4AF}",
  U: "\u{1D4B0}",
  V: "\u{1D4B1}",
  W: "\u{1D4B2}",
  X: "\u{1D4B3}",
  Y: "\u{1D4B4}",
  Z: "\u{1D4B5}"
};

const DEFAULT_MATH_FEATURES = {
  environments: true,
  stretchyDelimiters: "scale" as const,
  accents: true,
  bigOperators: true,
  debugOverlays: false
};

export type MathBox = {
  w: number;
  a: number;
  d: number;
  emit: (xPt: number, yBaselinePt: number, ops: DrawOp[]) => void;
};

export type MathLayoutContext = {
  metrics: FontMetricsProvider;
  fontId: string;
  textFontId?: string;
  monoFontId?: string;
  baseFontSizePt: number;
  displayMode?: boolean;
  features?: {
    environments?: boolean;
    stretchyDelimiters?: "scale" | "assemble" | "off";
    accents?: boolean;
    bigOperators?: boolean;
    debugOverlays?: boolean;
  };
};

type NormalizedMathLayoutContext = {
  metrics: FontMetricsProvider;
  fontId: string;
  textFontId: string;
  monoFontId: string;
  baseFontSizePt: number;
  displayMode: boolean;
  features: {
    environments: boolean;
    stretchyDelimiters: "scale" | "assemble" | "off";
    accents: boolean;
    bigOperators: boolean;
    debugOverlays: boolean;
  };
};

type StyleLevel = 0 | 1 | 2;
type CellAlign = "left" | "center" | "right";
type GridBaselineMode = "extentCenter" | "rowBaselineCenter";
type DelimiterAlignMode = "extentWrap" | "axisCentered";

export function layoutMathExpression(expr: string, ctx: MathLayoutContext): MathBox {
  const expandedExpr = expandMathMacros(expr);
  const ast = parseMath(expandedExpr);
  return layoutNode(ast, normalizeContext(ctx), 0);
}

function normalizeContext(ctx: MathLayoutContext): NormalizedMathLayoutContext {
  return {
    metrics: ctx.metrics,
    fontId: ctx.fontId,
    textFontId: ctx.textFontId ?? ctx.fontId,
    monoFontId: ctx.monoFontId ?? ctx.textFontId ?? ctx.fontId,
    baseFontSizePt: ctx.baseFontSizePt,
    displayMode: ctx.displayMode ?? false,
    features: {
      environments: ctx.features?.environments ?? DEFAULT_MATH_FEATURES.environments,
      stretchyDelimiters:
        ctx.features?.stretchyDelimiters ?? DEFAULT_MATH_FEATURES.stretchyDelimiters,
      accents: ctx.features?.accents ?? DEFAULT_MATH_FEATURES.accents,
      bigOperators: ctx.features?.bigOperators ?? DEFAULT_MATH_FEATURES.bigOperators,
      debugOverlays: ctx.features?.debugOverlays ?? DEFAULT_MATH_FEATURES.debugOverlays
    }
  };
}

function layoutNode(
  node: MathNode,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  switch (node.kind) {
    case "symbol":
      return textRunBox(node.value, forcedFontId ?? ctx.fontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
    case "text":
      return textRunBox(node.value, forcedFontId ?? ctx.textFontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
    case "space":
      return spaceBox(node.amount, mathFontSize(ctx.baseFontSizePt, styleLevel));
    case "row": {
      const laidOut = node.children.map((child) => ({ node: child, box: layoutNode(child, ctx, styleLevel, forcedFontId) }));
      return rowBox(laidOut, ctx, styleLevel);
    }
    case "supsub":
      return supSubBox(node, ctx, styleLevel, forcedFontId);
    case "fraction":
      return fractionBox(node, ctx, styleLevel, forcedFontId);
    case "binom":
      return binomBox(node, ctx, styleLevel, forcedFontId);
    case "sqrt":
      return sqrtBox(node, ctx, styleLevel, forcedFontId);
    case "overunder":
      return overUnderBox(node, ctx, styleLevel, forcedFontId);
    case "operatorname":
      return operatorNameBox(node, ctx, styleLevel, forcedFontId);
    case "style":
      return styleBox(node, ctx, styleLevel, forcedFontId);
    case "environment":
      return environmentBox(node, ctx, styleLevel);
    case "delimited":
      return delimitedBox(node.left, node.right, node.body, ctx, styleLevel, forcedFontId);
    default:
      return textRunBox("?", forcedFontId ?? ctx.fontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
  }
}

function textRunBox(
  text: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider
): MathBox {
  if (!text) {
    return emptyBox();
  }

  const xOffsetsPt: number[] = [];
  let width = 0;
  for (const char of text) {
    xOffsetsPt.push(width);
    width += metrics.getAdvanceWidth(fontId, char, fontSizePt);
  }

  return {
    w: width,
    a: metrics.getAscent(fontId, fontSizePt),
    d: metrics.getDescent(fontId, fontSizePt),
    emit: (xPt, yBaselinePt, ops) => {
      const op: GlyphRunOp = {
        kind: "glyphRun",
        fontId,
        fontSizePt,
        xPt,
        yBaselinePt,
        text,
        xOffsetsPt
      };
      ops.push(op);
    }
  };
}

function symbolBox(
  symbol: string,
  fontId: string,
  fontSizePt: number,
  metrics: FontMetricsProvider
): MathBox {
  if (!symbol) {
    return emptyBox();
  }
  if ([...symbol].length !== 1) {
    return textRunBox(symbol, fontId, fontSizePt, metrics);
  }

  const glyph = metrics.getGlyphMetrics(fontId, symbol, fontSizePt);
  return {
    w: glyph.widthPt,
    a: glyph.ascentPt,
    d: glyph.descentPt,
    emit: (xPt, yBaselinePt, ops) => {
      const op: GlyphRunOp = {
        kind: "glyphRun",
        fontId: glyph.fontId,
        fontSizePt,
        xPt,
        yBaselinePt,
        text: symbol,
        xOffsetsPt: [0]
      };
      ops.push(op);
    }
  };
}

function emptyBox(): MathBox {
  return {
    w: 0,
    a: 0,
    d: 0,
    emit: () => undefined
  };
}

function rowBox(
  children: Array<{ node: MathNode; box: MathBox }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel
): MathBox {
  if (children.length === 0) {
    return emptyBox();
  }

  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const operatorSpace = fontSizePt * 0.16;
  const placements: Array<{ xPt: number; box: MathBox }> = [];
  let cursor = 0;
  let a = 0;
  let d = 0;

  for (let i = 0; i < children.length; i += 1) {
    const current = children[i];
    const prev = i > 0 ? children[i - 1] : null;
    const next = i + 1 < children.length ? children[i + 1] : null;

    if (prev && next && isSpacedOperatorNode(current.node)) {
      cursor += operatorSpace;
    }

    placements.push({ xPt: cursor, box: current.box });
    cursor += current.box.w;

    if (prev && next && isSpacedOperatorNode(current.node)) {
      cursor += operatorSpace;
    }

    a = Math.max(a, current.box.a);
    d = Math.max(d, current.box.d);
  }

  return {
    w: cursor,
    a,
    d,
    emit: (xPt, yBaselinePt, ops) => {
      for (const placement of placements) {
        placement.box.emit(xPt + placement.xPt, yBaselinePt, ops);
      }
    }
  };
}

function supSubBox(
  node: Extract<MathNode, { kind: "supsub" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  const base = layoutNode(node.base, ctx, styleLevel, forcedFontId);
  const sup = node.sup ? layoutNode(node.sup, ctx, nextStyle(styleLevel), forcedFontId) : null;
  const sub = node.sub ? layoutNode(node.sub, ctx, nextStyle(styleLevel), forcedFontId) : null;

  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const isDisplayBigOperator =
    ctx.features.bigOperators && ctx.displayMode && styleLevel === 0 && isBigOperatorNode(node.base);

  if (isDisplayBigOperator) {
    const w = Math.max(base.w, sup?.w ?? 0, sub?.w ?? 0);
    const supShift = sup ? base.a + sup.d + fontSizePt * 0.18 : 0;
    const subShift = sub ? base.d + sub.a + fontSizePt * 0.18 : 0;

    return {
      w,
      a: Math.max(base.a, sup ? supShift + sup.a : 0),
      d: Math.max(base.d, sub ? subShift + sub.d : 0),
      emit: (xPt, yBaselinePt, ops) => {
        base.emit(xPt + (w - base.w) / 2, yBaselinePt, ops);
        if (sup) {
          sup.emit(xPt + (w - sup.w) / 2, yBaselinePt - supShift, ops);
        }
        if (sub) {
          sub.emit(xPt + (w - sub.w) / 2, yBaselinePt + subShift, ops);
        }
      }
    };
  }

  const scriptGap = fontSizePt * 0.08;
  const supRise = sup ? Math.max(base.a * 0.72, sup.d + fontSizePt * 0.2) : 0;
  const subDrop = sub ? Math.max(base.d * 0.92 + fontSizePt * 0.1, sub.a * 0.8) : 0;
  const scriptW = Math.max(sup?.w ?? 0, sub?.w ?? 0);

  return {
    w: base.w + (sup || sub ? scriptGap + scriptW : 0),
    a: Math.max(base.a, sup ? supRise + sup.a : 0),
    d: Math.max(base.d, sub ? subDrop + sub.d : 0),
    emit: (xPt, yBaselinePt, ops) => {
      base.emit(xPt, yBaselinePt, ops);
      if (sup) {
        sup.emit(xPt + base.w + scriptGap, yBaselinePt - supRise, ops);
      }
      if (sub) {
        sub.emit(xPt + base.w + scriptGap, yBaselinePt + subDrop, ops);
      }
    }
  };
}

function fractionBox(
  node: Extract<MathNode, { kind: "fraction" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  const numerator = layoutNode(node.numerator, ctx, nextStyle(styleLevel), forcedFontId);
  const denominator = layoutNode(node.denominator, ctx, nextStyle(styleLevel), forcedFontId);
  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);

  const barThickness = Math.max(0.4, fontSizePt * 0.06);
  const gap = fontSizePt * 0.15;
  const sidePad = fontSizePt * 0.12;
  const contentWidth = Math.max(numerator.w, denominator.w);

  const numeratorHeight = numerator.a + numerator.d;
  const denominatorHeight = denominator.a + denominator.d;

  return {
    w: contentWidth + sidePad * 2,
    a: numeratorHeight + gap + barThickness / 2,
    d: denominatorHeight + gap + barThickness / 2,
    emit: (xPt, yBaselinePt, ops) => {
      const numX = xPt + sidePad + (contentWidth - numerator.w) / 2;
      const denX = xPt + sidePad + (contentWidth - denominator.w) / 2;
      const numeratorBottom = yBaselinePt - barThickness / 2 - gap;
      const denominatorTop = yBaselinePt + barThickness / 2 + gap;
      const numBaseline = numeratorBottom - numerator.d;
      const denBaseline = denominatorTop + denominator.a;

      numerator.emit(numX, numBaseline, ops);
      denominator.emit(denX, denBaseline, ops);

      const rule: RuleOp = {
        kind: "rule",
        xPt: xPt + sidePad,
        yPt: yBaselinePt - barThickness / 2,
        wPt: contentWidth,
        hPt: barThickness
      };
      ops.push(rule);
    }
  };
}

function sqrtBox(
  node: Extract<MathNode, { kind: "sqrt" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  /**
   * SQRT LAYOUT - Clean implementation from first principles
   * 
   * The radical glyph (√) has a built-in horizontal segment at its top-right.
   * Our job is to:
   * 1. Scale the radical tall enough to cover the radicand with clearance
   * 2. Position the radical so its top aligns properly
   * 3. Draw an overbar that CONTINUES from the radical's top-right, extending over the radicand
   * 
   * Key insight: The overbar's Y position should match the radical glyph's visual top.
   * The overbar starts at the radical's right edge and extends rightward.
   */

  const radicand = layoutNode(node.body, ctx, styleLevel, forcedFontId);
  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const fontId = forcedFontId ?? ctx.fontId;

  // Typography constants (based on TeX conventions)
  const overbarThickness = Math.max(0.4, fontSizePt * 0.06);
  const clearance = fontSizePt * 0.12; // Gap between radicand top and overbar bottom
  const rightPad = fontSizePt * 0.08;  // Padding after radicand

  // Step 1: Calculate the required radical height
  // The radical must span: radicand depth + radicand ascent + clearance + overbar thickness
  // because the overbar is part of the visual unit
  const totalContentHeight = radicand.d + radicand.a + clearance + overbarThickness;

  // Step 2: Get a radical glyph scaled to exactly this height
  const baseSize = fontSizePt;
  const baseGlyph = ctx.metrics.getGlyphMetrics(fontId, "\u221A", baseSize);
  const baseHeight = baseGlyph.ascentPt + baseGlyph.descentPt;
  const scale = totalContentHeight / baseHeight;
  const radicalSize = baseSize * scale;

  const radical = symbolBox("\u221A", fontId, radicalSize, ctx.metrics);

  // Step 3: Position the radical vertically
  // We want the radical's BOTTOM to align with the radicand's bottom (baseline + depth)
  // radicalBottom = radicalBaseline + radical.d = radicand.d
  // Therefore: radicalBaseline = radicand.d - radical.d
  const radicalBaseline = radicand.d - radical.d;

  // Step 4: Calculate where the radical's top actually ends up
  // radicalTop = radicalBaseline - radical.a
  const radicalTop = radicalBaseline - radical.a;

  // Step 5: The overbar should be at the radical's top
  // The bar's bottom edge should be at or very near the radical's top
  // We position the bar so its bottom aligns with the radical top
  const barBottom = radicalTop;
  const barTop = barBottom - overbarThickness;

  // Step 6: Horizontal positioning
  // The overbar starts at the radical's right edge and extends over the radicand
  const radicandX = radical.w;
  const barX = radical.w;
  const barWidth = radicand.w + rightPad;

  // Step 7: Handle nth root degree positioning
  const degree = node.degree ? layoutNode(node.degree, ctx, 2, forcedFontId) : null;
  // Position the degree in the "notch" of the radical, raised
  const degreeBaseline = degree ? barTop + fontSizePt * 0.1 : 0;
  const degreeX = degree ? Math.max(radical.w * 0.15 - degree.w, -fontSizePt * 0.1) : 0;

  // Step 8: Calculate total bounding box
  const leftMost = Math.min(0, degree ? degreeX : 0);
  const rightMost = radicandX + radicand.w + rightPad;
  const shiftX = -leftMost;
  const width = rightMost - leftMost;

  const top = Math.min(barTop, degree ? degreeBaseline - degree.a : Infinity);
  const bottom = Math.max(radicand.d, radicalBaseline + radical.d);

  return {
    w: width,
    a: -top,
    d: bottom,
    emit: (xPt, yBaselinePt, ops) => {
      // Emit degree (nth root index) if present
      if (degree) {
        degree.emit(xPt + shiftX + degreeX, yBaselinePt + degreeBaseline, ops);
      }

      // Emit radical glyph
      radical.emit(xPt + shiftX, yBaselinePt + radicalBaseline, ops);

      // Emit radicand content
      radicand.emit(xPt + shiftX + radicandX, yBaselinePt, ops);

      // Emit overbar - continues from radical's top-right corner
      const rule: RuleOp = {
        kind: "rule",
        xPt: xPt + shiftX + barX,
        yPt: yBaselinePt + barTop,
        wPt: barWidth,
        hPt: overbarThickness,
        role: "sqrtOverbar"
      };
      ops.push(rule);

      if (ctx.features.debugOverlays) {
        ops.push({
          kind: "debugBox",
          xPt: xPt + shiftX + radicandX,
          yPt: yBaselinePt - radicand.a,
          wPt: radicand.w,
          hPt: radicand.a + radicand.d,
          label: "sqrt-inner"
        });
        ops.push({
          kind: "debugBox",
          xPt: xPt + shiftX,
          yPt: yBaselinePt + radicalTop,
          wPt: radical.w,
          hPt: radical.a + radical.d,
          label: "sqrt-radical"
        });
      }
    }
  };
}

function binomBox(
  node: Extract<MathNode, { kind: "binom" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  const upper = layoutNode(node.upper, ctx, nextStyle(styleLevel), forcedFontId);
  const lower = layoutNode(node.lower, ctx, nextStyle(styleLevel), forcedFontId);
  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const gap = fontSizePt * 0.2;
  const sidePad = fontSizePt * 0.1;
  const contentWidth = Math.max(upper.w, lower.w);
  const contentHeight = upper.a + upper.d + gap + lower.a + lower.d;
  const baselineFromTop = upper.a + upper.d + gap + lower.a;

  const stack: MathBox = {
    w: contentWidth + sidePad * 2,
    a: baselineFromTop,
    d: Math.max(0, contentHeight - baselineFromTop),
    emit: (xPt, yBaselinePt, ops) => {
      const topBaseline = yBaselinePt - (lower.a + gap + upper.d);
      const bottomBaseline = yBaselinePt + (upper.d + gap + lower.a);
      upper.emit(xPt + sidePad + (contentWidth - upper.w) / 2, topBaseline, ops);
      lower.emit(xPt + sidePad + (contentWidth - lower.w) / 2, bottomBaseline, ops);
    }
  };

  return wrapWithDelimiters("(", ")", stack, ctx, styleLevel, forcedFontId);
}

function overUnderBox(
  node: Extract<MathNode, { kind: "overunder" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  const base = layoutNode(node.base, ctx, styleLevel, forcedFontId);
  const over = node.over ? layoutNode(node.over, ctx, nextStyle(styleLevel), forcedFontId) : null;
  const under = node.under ? layoutNode(node.under, ctx, nextStyle(styleLevel), forcedFontId) : null;
  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const gap = fontSizePt * 0.12;
  const overShift = over ? base.a + gap + over.d : 0;
  const underShift = under ? base.d + gap + under.a : 0;
  const w = Math.max(base.w, over?.w ?? 0, under?.w ?? 0);

  return {
    w,
    a: Math.max(base.a, over ? overShift + over.a : 0),
    d: Math.max(base.d, under ? underShift + under.d : 0),
    emit: (xPt, yBaselinePt, ops) => {
      base.emit(xPt + (w - base.w) / 2, yBaselinePt, ops);
      if (over) {
        over.emit(xPt + (w - over.w) / 2, yBaselinePt - overShift, ops);
      }
      if (under) {
        under.emit(xPt + (w - under.w) / 2, yBaselinePt + underShift, ops);
      }
    }
  };
}

function operatorNameBox(
  node: Extract<MathNode, { kind: "operatorname" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  return textRunBox(
    node.name,
    forcedFontId ?? ctx.textFontId,
    mathFontSize(ctx.baseFontSizePt, styleLevel),
    ctx.metrics
  );
}

function styleBox(
  node: Extract<MathNode, { kind: "style" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  let targetFontId = forcedFontId ?? ctx.fontId;
  switch (node.style) {
    case "mathrm":
    case "mathsf":
      targetFontId = ctx.textFontId;
      break;
    case "mathtt":
      targetFontId = ctx.monoFontId;
      break;
    default:
      targetFontId = forcedFontId ?? ctx.fontId;
      break;
  }

  const transformed = transformNodeForStyle(node.body, node.style);
  return layoutNode(transformed, ctx, styleLevel, targetFontId);
}

function transformNodeForStyle(
  node: MathNode,
  style: Extract<MathNode, { kind: "style" }>['style']
): MathNode {
  if (style !== "mathbb" && style !== "mathcal") {
    return node;
  }
  const mapper = style === "mathbb" ? mapMathbbChar : mapMathcalChar;

  switch (node.kind) {
    case "symbol":
      return { kind: "symbol", value: mapString(node.value, mapper) };
    case "text":
      return { kind: "text", value: mapString(node.value, mapper) };
    case "row":
      return { kind: "row", children: node.children.map((child) => transformNodeForStyle(child, style)) };
    case "fraction":
      return {
        kind: "fraction",
        numerator: transformNodeForStyle(node.numerator, style),
        denominator: transformNodeForStyle(node.denominator, style)
      };
    case "binom":
      return {
        kind: "binom",
        upper: transformNodeForStyle(node.upper, style),
        lower: transformNodeForStyle(node.lower, style)
      };
    case "sqrt":
      return {
        kind: "sqrt",
        body: transformNodeForStyle(node.body, style),
        degree: node.degree ? transformNodeForStyle(node.degree, style) : undefined
      };
    case "overunder":
      return {
        kind: "overunder",
        base: transformNodeForStyle(node.base, style),
        over: node.over ? transformNodeForStyle(node.over, style) : undefined,
        under: node.under ? transformNodeForStyle(node.under, style) : undefined
      };
    case "supsub":
      return {
        kind: "supsub",
        base: transformNodeForStyle(node.base, style),
        sup: node.sup ? transformNodeForStyle(node.sup, style) : undefined,
        sub: node.sub ? transformNodeForStyle(node.sub, style) : undefined
      };
    case "delimited":
      return {
        kind: "delimited",
        left: node.left,
        right: node.right,
        body: transformNodeForStyle(node.body, style)
      };
    case "style":
      return {
        kind: "style",
        style: node.style,
        body: transformNodeForStyle(node.body, style)
      };
    case "operatorname":
      return {
        kind: "operatorname",
        name: mapString(node.name, mapper)
      };
    default:
      return node;
  }
}

function mapString(input: string, mapper: (char: string) => string): string {
  let out = "";
  for (const char of input) {
    out += mapper(char);
  }
  return out;
}

function mapMathbbChar(char: string): string {
  return MATHBB_CHAR_MAP[char] ?? char;
}

function mapMathcalChar(char: string): string {
  return MATHCAL_CHAR_MAP[char] ?? char;
}

function delimitedBox(
  left: string,
  right: string,
  bodyNode: MathNode,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  const body = layoutNode(bodyNode, ctx, styleLevel, forcedFontId);
  return wrapWithDelimiters(left, right, body, ctx, styleLevel, forcedFontId);
}

function wrapWithDelimiters(
  left: string,
  right: string,
  body: MathBox,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string,
  alignMode: DelimiterAlignMode = "extentWrap"
): MathBox {
  const fontSizePt = mathFontSize(ctx.baseFontSizePt, styleLevel);
  const padY = fontSizePt * 0.12;

  // Math axis height: where the = sign center sits (typically ~0.25em above baseline)
  const axisHeight = fontSizePt * 0.25;

  // For axis centering, we shift the body so its vertical center aligns with the math axis
  // Body center (relative to body baseline) = (body.d - body.a) / 2
  // We want: bodyBaseline + bodyCenter = -axisHeight (axis is above 0)
  // So: bodyShift = -axisHeight - (body.d - body.a) / 2
  const bodyShift = alignMode === "axisCentered" ? -axisHeight - (body.d - body.a) / 2 : 0;

  // Compute the content extents after body shift
  const shiftedBodyTop = bodyShift - body.a;
  const shiftedBodyBottom = bodyShift + body.d;

  // For delimiters, use the shifted body extents
  const innerTop = alignMode === "axisCentered" ? shiftedBodyTop : -body.a;
  const innerBottom = alignMode === "axisCentered" ? shiftedBodyBottom : body.d;
  const targetTop = innerTop - padY;
  const targetBottom = innerBottom + padY;
  const targetHeight = targetBottom - targetTop;

  const leftDelim = createDelimiterBox(left, targetHeight, ctx, styleLevel, forcedFontId);
  const rightDelim = createDelimiterBox(right, targetHeight, ctx, styleLevel, forcedFontId);
  const leftShift = left ? targetTop + leftDelim.a : 0;
  const rightShift = right ? targetTop + rightDelim.a : 0;

  const gap = fontSizePt * 0.12;
  const leftGap = left ? gap : 0;
  const rightGap = right ? gap : 0;

  const w = leftDelim.w + leftGap + body.w + rightGap + rightDelim.w;

  // Compute overall box extents (relative to output baseline)
  const top = Math.min(
    shiftedBodyTop,
    left ? leftShift - leftDelim.a : Infinity,
    right ? rightShift - rightDelim.a : Infinity
  );
  const bottom = Math.max(
    shiftedBodyBottom,
    left ? leftShift + leftDelim.d : -Infinity,
    right ? rightShift + rightDelim.d : -Infinity
  );

  return {
    w,
    a: -top,
    d: bottom,
    emit: (xPt, yBaselinePt, ops) => {
      let cursorX = xPt;
      if (left) {
        leftDelim.emit(cursorX, yBaselinePt + leftShift, ops);
      }
      cursorX += leftDelim.w + leftGap;
      // Emit body with the axis-centering shift applied
      body.emit(cursorX, yBaselinePt + bodyShift, ops);
      cursorX += body.w + rightGap;
      if (right) {
        rightDelim.emit(cursorX, yBaselinePt + rightShift, ops);
      }

      if (ctx.features.debugOverlays) {
        const lineWidth = w;
        const leftX = xPt;
        const bodyX = xPt + leftDelim.w + leftGap;
        const rightX = bodyX + body.w + rightGap;
        ops.push({
          kind: "rule",
          xPt,
          yPt: yBaselinePt + targetTop,
          wPt: lineWidth,
          hPt: 0.4,
          colorRgb: [0.15, 0.65, 0.15]
        });
        ops.push({
          kind: "rule",
          xPt,
          yPt: yBaselinePt + targetBottom,
          wPt: lineWidth,
          hPt: 0.4,
          colorRgb: [0.15, 0.65, 0.15]
        });
        ops.push({
          kind: "debugBox",
          xPt: bodyX,
          yPt: yBaselinePt - body.a,
          wPt: body.w,
          hPt: body.a + body.d,
          label: "delim-inner"
        });
        if (left) {
          ops.push({
            kind: "debugBox",
            xPt: leftX,
            yPt: yBaselinePt + leftShift - leftDelim.a,
            wPt: leftDelim.w,
            hPt: leftDelim.a + leftDelim.d,
            label: "delim-left"
          });
        }
        if (right) {
          ops.push({
            kind: "debugBox",
            xPt: rightX,
            yPt: yBaselinePt + rightShift - rightDelim.a,
            wPt: rightDelim.w,
            hPt: rightDelim.a + rightDelim.d,
            label: "delim-right"
          });
        }
      }
    }
  };
}

function createDelimiterBox(
  symbol: string,
  targetHeightPt: number,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel,
  forcedFontId?: string
): MathBox {
  if (!symbol) {
    return emptyBox();
  }
  const fontId = forcedFontId ?? ctx.fontId;
  const baseSize = mathFontSize(ctx.baseFontSizePt, styleLevel);
  if (ctx.features.stretchyDelimiters === "off") {
    return symbolBox(symbol, fontId, baseSize, ctx.metrics);
  }

  if (
    ctx.features.stretchyDelimiters === "assemble" &&
    (symbol === "|" || symbol === "\u2016")
  ) {
    const target = Math.max(baseSize, targetHeightPt);
    const thickness = Math.max(0.45, baseSize * 0.06);
    const gap = Math.max(thickness, baseSize * 0.09);
    const isDouble = symbol === "\u2016";
    const width = isDouble ? thickness * 2 + gap : thickness;
    const ascent = target * 0.5;
    const descent = target - ascent;

    return {
      w: width,
      a: ascent,
      d: descent,
      emit: (xPt, yBaselinePt, ops) => {
        const yPt = yBaselinePt - ascent;
        const hPt = ascent + descent;
        const emitBar = (x: number): void => {
          const rule: RuleOp = {
            kind: "rule",
            xPt: x,
            yPt,
            wPt: thickness,
            hPt
          };
          ops.push(rule);
        };

        emitBar(xPt);
        if (isDouble) {
          emitBar(xPt + thickness + gap);
        }
      }
    };
  }

  const baseGlyph = ctx.metrics.getGlyphMetrics(fontId, symbol, baseSize);
  const baseHeight = Math.max(0.1, baseGlyph.ascentPt + baseGlyph.descentPt);
  const scale = targetHeightPt / baseHeight;
  const scaledSize = Math.max(baseSize, baseSize * scale);
  return symbolBox(symbol, fontId, scaledSize, ctx.metrics);
}

function environmentBox(
  node: Extract<MathNode, { kind: "environment" }>,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel
): MathBox {
  if (!ctx.features.environments) {
    return textRunBox(`\\begin{${node.name}}`, ctx.fontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
  }

  switch (node.name) {
    case "aligned":
    case "align":
    case "split":
      return alignedBox(node.body, ctx, styleLevel);
    case "gather":
      return gatherBox(node.body, ctx, styleLevel);
    case "cases":
      return casesBox(node.body, ctx, styleLevel);
    case "matrix":
    case "pmatrix":
    case "bmatrix":
    case "vmatrix":
    case "Vmatrix":
      return matrixBox(node.name, node.body, ctx, styleLevel);
    case "array":
      return arrayBox(node.body, ctx, styleLevel);
    default:
      return textRunBox(`\\begin{${node.name}}`, ctx.fontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
  }
}

function alignedBox(body: string, ctx: NormalizedMathLayoutContext, styleLevel: StyleLevel): MathBox {
  const rows = splitRows(body).map((row) => splitColumns(row));
  if (rows.length === 0) {
    return emptyBox();
  }

  const gridRows = rows.map((row) =>
    row.map((cell) => ({
      box: layoutCellExpression(cell, ctx, styleLevel),
      align: "left" as const
    }))
  );

  return buildGridBox(gridRows, {
    colGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.45,
    rowGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.35
  });
}

function gatherBox(body: string, ctx: NormalizedMathLayoutContext, styleLevel: StyleLevel): MathBox {
  const rows = splitRows(body);
  const gridRows = rows.map((row) => [
    {
      box: layoutCellExpression(row, ctx, styleLevel),
      align: "center" as const
    }
  ]);

  return buildGridBox(gridRows, {
    colGapPt: 0,
    rowGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.35
  });
}

function casesBox(body: string, ctx: NormalizedMathLayoutContext, styleLevel: StyleLevel): MathBox {
  const rows = splitRows(body).map((row) => splitColumns(row));
  const gridRows = rows.map((row) => {
    const left = row[0] ?? "";
    const right = row[1] ?? "";
    return [
      { box: layoutCellExpression(left, ctx, styleLevel), align: "left" as const },
      { box: layoutCellExpression(right, ctx, styleLevel), align: "left" as const }
    ];
  });

  const content = buildGridBox(gridRows, {
    colGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.8,
    rowGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.3,
    baselineMode: "rowBaselineCenter"
  });

  return wrapWithDelimiters("{", "", content, ctx, styleLevel, undefined, "axisCentered");
}

function matrixBox(
  envName: "matrix" | "pmatrix" | "bmatrix" | "vmatrix" | "Vmatrix",
  body: string,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel
): MathBox {
  const rows = splitRows(body).map((row) => splitColumns(row));
  const gridRows = rows.map((row) =>
    row.map((cell) => ({
      box: layoutCellExpression(cell, ctx, styleLevel),
      align: "center" as const
    }))
  );

  const content = buildGridBox(gridRows, {
    colGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.5,
    rowGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.3
  });

  switch (envName) {
    case "pmatrix":
      return wrapWithDelimiters("(", ")", content, ctx, styleLevel);
    case "bmatrix":
      return wrapWithDelimiters("[", "]", content, ctx, styleLevel);
    case "vmatrix":
      return wrapWithDelimiters("|", "|", content, ctx, styleLevel);
    case "Vmatrix":
      return wrapWithDelimiters("\u2016", "\u2016", content, ctx, styleLevel);
    default:
      return content;
  }
}

function arrayBox(body: string, ctx: NormalizedMathLayoutContext, styleLevel: StyleLevel): MathBox {
  const { alignments, content } = extractArrayAlignmentSpec(body);
  const rows = splitRows(content).map((row) => splitColumns(row));

  const gridRows = rows.map((row) =>
    row.map((cell, colIdx) => ({
      box: layoutCellExpression(cell, ctx, styleLevel),
      align: alignments[colIdx] ?? "left"
    }))
  );

  return buildGridBox(gridRows, {
    colGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.45,
    rowGapPt: mathFontSize(ctx.baseFontSizePt, styleLevel) * 0.3
  });
}

function layoutCellExpression(
  expr: string,
  ctx: NormalizedMathLayoutContext,
  styleLevel: StyleLevel
): MathBox {
  const trimmed = expr.trim();
  if (!trimmed) {
    return spaceBox("thin", mathFontSize(ctx.baseFontSizePt, styleLevel));
  }

  try {
    return layoutNode(parseMath(trimmed), ctx, styleLevel);
  } catch {
    return textRunBox(trimmed, ctx.fontId, mathFontSize(ctx.baseFontSizePt, styleLevel), ctx.metrics);
  }
}

function buildGridBox(
  rows: Array<Array<{ box: MathBox; align: CellAlign }>>,
  options: { colGapPt: number; rowGapPt: number; baselineMode?: GridBaselineMode }
): MathBox {
  if (rows.length === 0) {
    return emptyBox();
  }

  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const colWidths = new Array<number>(colCount).fill(0);
  const rowAscents = new Array<number>(rows.length).fill(0);
  const rowDescents = new Array<number>(rows.length).fill(0);

  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[r].length; c += 1) {
      const box = rows[r][c].box;
      colWidths[c] = Math.max(colWidths[c], box.w);
      rowAscents[r] = Math.max(rowAscents[r], box.a);
      rowDescents[r] = Math.max(rowDescents[r], box.d);
    }
  }

  const colStarts = new Array<number>(colCount).fill(0);
  let width = 0;
  for (let c = 0; c < colCount; c += 1) {
    colStarts[c] = width;
    width += colWidths[c];
    if (c < colCount - 1) {
      width += options.colGapPt;
    }
  }

  const rowHeights = rowAscents.map((a, idx) => a + rowDescents[idx]);
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * options.rowGapPt;
  const rowBaselinesFromTop = new Array<number>(rows.length).fill(0);
  let baselineCursorTop = 0;
  for (let r = 0; r < rows.length; r += 1) {
    rowBaselinesFromTop[r] = baselineCursorTop + rowAscents[r];
    baselineCursorTop += rowHeights[r] + options.rowGapPt;
  }

  const baselineFromTop =
    options.baselineMode === "rowBaselineCenter" && rowBaselinesFromTop.length > 1
      ? (rowBaselinesFromTop[0] + rowBaselinesFromTop[rowBaselinesFromTop.length - 1]) / 2
      : totalHeight / 2;

  return {
    w: width,
    a: baselineFromTop,
    d: totalHeight - baselineFromTop,
    emit: (xPt, yBaselinePt, ops) => {
      for (let r = 0; r < rows.length; r += 1) {
        const rowBaseline = yBaselinePt + rowBaselinesFromTop[r] - baselineFromTop;

        for (let c = 0; c < rows[r].length; c += 1) {
          const cell = rows[r][c];
          const colW = colWidths[c];
          const left = colStarts[c];
          const offsetWithinCol =
            cell.align === "center"
              ? (colW - cell.box.w) / 2
              : cell.align === "right"
                ? colW - cell.box.w
                : 0;
          cell.box.emit(xPt + left + offsetWithinCol, rowBaseline, ops);
        }
      }
    }
  };
}

function splitRows(body: string): string[] {
  return splitTopLevel(body, "row").map((part) => part.trim()).filter((part) => part.length > 0);
}

function splitColumns(row: string): string[] {
  const parts = splitTopLevel(row, "column").map((part) => part.trim());
  return parts.length > 0 ? parts : [""];
}

function splitTopLevel(input: string, mode: "row" | "column"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const prev = i > 0 ? input[i - 1] : "";

    if (char === "{" && prev !== "\\") {
      depth += 1;
      continue;
    }
    if (char === "}" && prev !== "\\") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (mode === "column" && char === "&" && prev !== "\\") {
      parts.push(input.slice(start, i));
      start = i + 1;
      continue;
    }

    if (
      mode === "row" &&
      char === "\\" &&
      input[i + 1] === "\\" &&
      prev !== "\\"
    ) {
      parts.push(input.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }

  parts.push(input.slice(start));
  return parts;
}

function extractArrayAlignmentSpec(body: string): {
  alignments: CellAlign[];
  content: string;
} {
  let cursor = 0;
  while (cursor < body.length && /\s/.test(body[cursor])) {
    cursor += 1;
  }

  if (body[cursor] !== "{") {
    return { alignments: [], content: body };
  }

  let depth = 0;
  for (let i = cursor; i < body.length; i += 1) {
    const char = body[i];
    if (char === "{" && body[i - 1] !== "\\") {
      depth += 1;
      continue;
    }
    if (char === "}" && body[i - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) {
        const spec = body.slice(cursor + 1, i);
        const content = body.slice(i + 1);
        return {
          alignments: spec
            .split("")
            .filter((token) => token === "l" || token === "c" || token === "r")
            .map((token) => (token === "c" ? "center" : token === "r" ? "right" : "left")),
          content
        };
      }
    }
  }

  return { alignments: [], content: body };
}

function spaceBox(amount: Extract<MathNode, { kind: "space" }>['amount'], fontSizePt: number): MathBox {
  const factor =
    amount === "thin"
      ? 0.166
      : amount === "medium"
        ? 0.222
        : amount === "thick"
          ? 0.277
          : amount === "quad"
            ? 1
            : 2;

  return {
    w: fontSizePt * factor,
    a: 0,
    d: 0,
    emit: () => undefined
  };
}

function nextStyle(styleLevel: StyleLevel): 1 | 2 {
  return styleLevel === 0 ? 1 : 2;
}

function mathFontSize(base: number, styleLevel: StyleLevel): number {
  if (styleLevel === 1) {
    return base * 0.7;
  }
  if (styleLevel === 2) {
    return base * 0.5;
  }
  return base;
}

function isSpacedOperatorNode(node: MathNode): boolean {
  if (node.kind === "symbol") {
    return SPACED_OPERATOR_SYMBOLS.has(node.value);
  }
  return node.kind === "operatorname";
}

function isBigOperatorNode(node: MathNode): boolean {
  if (node.kind === "symbol") {
    return BIG_OPERATOR_SYMBOLS.has(node.value);
  }
  if (node.kind === "style") {
    return isBigOperatorNode(node.body);
  }
  return false;
}


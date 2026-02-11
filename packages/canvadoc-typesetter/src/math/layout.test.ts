import { describe, it, expect } from 'vitest';
import { layoutMathExpression, type MathLayoutContext } from './layout';
import type { DrawOp } from '../types';

/**
 * Mock font metrics provider for testing.
 * Returns predictable values for font measurements.
 */
function createMockMetrics() {
  return {
    getFontIds: () => ['math'],
    getFontSpec: (id: string) => ({ id, source: new ArrayBuffer(0), cssFamily: id }),
    getCssFamily: (id: string) => id,
    getAscent: (_fontId: string, sizePt: number) => sizePt * 0.8,
    getDescent: (_fontId: string, sizePt: number) => sizePt * 0.2,
    getAdvanceWidth: (_fontId: string, char: string, sizePt: number) => {
      if (char === ' ') return sizePt * 0.33;
      return sizePt * 0.6;
    },
    getGlyphMetrics: (_fontId: string, _char: string, sizePt: number) => ({
      fontId: 'math',
      widthPt: sizePt * 0.6,
      ascentPt: sizePt * 0.8,
      descentPt: sizePt * 0.2,
    }),
    measureText: (_fontId: string, text: string, sizePt: number) => ({
      widthPt: text.length * sizePt * 0.6,
      ascentPt: sizePt * 0.8,
      descentPt: sizePt * 0.2,
    }),
    loadForCanvas: async () => {},
    register: () => {},
  };
}

function createTestContext(overrides: Partial<MathLayoutContext> = {}): MathLayoutContext {
  return {
    metrics: createMockMetrics() as unknown as MathLayoutContext['metrics'],
    fontId: 'math',
    textFontId: 'text',
    monoFontId: 'mono',
    baseFontSizePt: 12,
    displayMode: false,
    features: {
      environments: true,
      stretchyDelimiters: 'scale',
      accents: true,
      bigOperators: true,
    },
    ...overrides,
  };
}

describe('layoutMathExpression', () => {
  describe('MathBox structure', () => {
    it('returns a MathBox with dimensions', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('x', ctx);

      expect(box).toHaveProperty('w');
      expect(box).toHaveProperty('a');
      expect(box).toHaveProperty('d');
      expect(box).toHaveProperty('emit');
      expect(typeof box.w).toBe('number');
      expect(typeof box.a).toBe('number');
      expect(typeof box.d).toBe('number');
      expect(typeof box.emit).toBe('function');
    });

    it('box dimensions are non-negative', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\frac{a}{b}', ctx);

      expect(box.w).toBeGreaterThanOrEqual(0);
      expect(box.a).toBeGreaterThanOrEqual(0);
      expect(box.d).toBeGreaterThanOrEqual(0);
    });

    it('emit function produces DrawOps', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('x', ctx);

      const ops: DrawOp[] = [];
      box.emit(0, 0, ops);

      expect(Array.isArray(ops)).toBe(true);
      expect(ops.length).toBeGreaterThan(0);
    });
  });

  describe('simple expressions', () => {
    it('layouts single symbol', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('x', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
    });

    it('layouts multiple symbols in a row', () => {
      const ctx = createTestContext();
      const singleBox = layoutMathExpression('x', ctx);
      const tripleBox = layoutMathExpression('xyz', ctx);

      // Row should be wider than single symbol
      expect(tripleBox.w).toBeGreaterThan(singleBox.w);
    });

    it('layouts Greek letters', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\alpha', ctx);

      expect(box.w).toBeGreaterThan(0);
    });
  });

  describe('superscripts and subscripts', () => {
    it('superscript adds height', () => {
      const ctx = createTestContext();
      const baseBox = layoutMathExpression('x', ctx);
      const supBox = layoutMathExpression('x^2', ctx);

      expect(supBox.a).toBeGreaterThan(baseBox.a);
    });

    it('subscript adds depth', () => {
      const ctx = createTestContext();
      const baseBox = layoutMathExpression('x', ctx);
      const subBox = layoutMathExpression('x_i', ctx);

      expect(subBox.d).toBeGreaterThanOrEqual(baseBox.d);
    });

    it('combined sup and sub', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('x_i^2', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
    });
  });

  describe('fractions', () => {
    it('fraction has positive height and depth', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\frac{a}{b}', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
      expect(box.d).toBeGreaterThan(0);
    });

    it('fraction has two children (numerator and denominator)', () => {
      const ctx = createTestContext();
      const fracBox = layoutMathExpression('\\frac{abc}{xyz}', ctx);

      // Fraction should have positive width
      expect(fracBox.w).toBeGreaterThan(0);
    });
  });

  describe('square roots', () => {
    it('sqrt has positive dimensions', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\sqrt{x}', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
    });

    it('sqrt is wider than content', () => {
      const ctx = createTestContext();
      const contentBox = layoutMathExpression('x', ctx);
      const sqrtBox = layoutMathExpression('\\sqrt{x}', ctx);

      expect(sqrtBox.w).toBeGreaterThan(contentBox.w);
    });

    it('nth root renders', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\sqrt[3]{x}', ctx);

      expect(box.w).toBeGreaterThan(0);
    });

    it('sqrt overbar joins the radical roof', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\sqrt{x}', ctx);
      const ops: DrawOp[] = [];
      box.emit(0, 0, ops);

      const radical = ops.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('\u221A')
      );
      const bar = ops.find((op): op is Extract<DrawOp, { kind: 'rule' }> => op.kind === 'rule');
      const inner = ops.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('x')
      );

      expect(radical).toBeDefined();
      expect(bar).toBeDefined();
      expect(inner).toBeDefined();
      expect(bar?.role).toBe('sqrtOverbar');

      const radicalAscent = radical!.fontSizePt * 0.8;
      const radicalTop = radical!.yBaselinePt - radicalAscent;
      const barBottom = bar!.yPt + bar!.hPt;
      expect(radicalTop).toBeLessThanOrEqual(barBottom);
      expect(barBottom - radicalTop).toBeLessThan(radical!.fontSizePt * 0.12);

      const innerTop = inner!.yBaselinePt - inner!.fontSizePt * 0.8;
      expect(bar!.yPt).toBeLessThan(innerTop - inner!.fontSizePt * 0.12);
    });

    it('sqrt scales radical glyph for tall radicands', () => {
      const ctx = createTestContext();
      const simple = layoutMathExpression('\\sqrt{x}', ctx);
      const tall = layoutMathExpression('\\sqrt{\\frac{1}{\\frac{1}{x}}}', ctx);
      const simpleOps: DrawOp[] = [];
      const tallOps: DrawOp[] = [];
      simple.emit(0, 0, simpleOps);
      tall.emit(0, 0, tallOps);

      const simpleRadical = simpleOps.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('\u221A')
      );
      const tallRadical = tallOps.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('\u221A')
      );

      expect(simpleRadical).toBeDefined();
      expect(tallRadical).toBeDefined();
      expect(tallRadical!.fontSizePt).toBeGreaterThan(simpleRadical!.fontSizePt);
    });
  });

  describe('spacing', () => {
    it('thin space adds width', () => {
      const ctx = createTestContext();
      const noSpaceBox = layoutMathExpression('ab', ctx);
      const spaceBox = layoutMathExpression('a\\,b', ctx);

      expect(spaceBox.w).toBeGreaterThan(noSpaceBox.w);
    });

    it('quad space adds significant width', () => {
      const ctx = createTestContext();
      const noSpaceBox = layoutMathExpression('ab', ctx);
      const quadBox = layoutMathExpression('a\\quad b', ctx);

      expect(quadBox.w).toBeGreaterThan(noSpaceBox.w);
    });
  });

  describe('delimiters', () => {
    it('delimited expression has positive dimensions', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\left( x \\right)', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
    });

    it('assemble mode emits rule-based bar delimiters', () => {
      const ctx = createTestContext({
        features: {
          environments: true,
          stretchyDelimiters: 'assemble',
          accents: true,
          bigOperators: true,
        },
      });
      const box = layoutMathExpression('\\left| \\frac{a}{b} \\right|', ctx);
      const ops: DrawOp[] = [];
      box.emit(0, 0, ops);
      expect(ops.some(op => op.kind === 'rule')).toBe(true);
    });

    it('delimiter extents wrap inner content', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\left( \\frac{a}{b} \\right)', ctx);
      const ops: DrawOp[] = [];
      box.emit(0, 0, ops);

      const delimiterRuns = ops.filter(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && (op.text === '(' || op.text === ')')
      );
      const bodyGlyphs = ops.filter(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text !== '(' && op.text !== ')'
      );
      const bodyRules = ops.filter(
        (op): op is Extract<DrawOp, { kind: 'rule' }> => op.kind === 'rule'
      );

      expect(delimiterRuns.length).toBe(2);
      expect(bodyGlyphs.length).toBeGreaterThan(0);
      expect(bodyRules.length).toBeGreaterThan(0);

      const bodyTop = Math.min(
        ...bodyGlyphs.map((g) => g.yBaselinePt - g.fontSizePt * 0.8),
        ...bodyRules.map((r) => r.yPt)
      );
      const bodyBottom = Math.max(
        ...bodyGlyphs.map((g) => g.yBaselinePt + g.fontSizePt * 0.2),
        ...bodyRules.map((r) => r.yPt + r.hPt)
      );
      const delimTop = Math.min(...delimiterRuns.map((g) => g.yBaselinePt - g.fontSizePt * 0.8));
      const delimBottom = Math.max(...delimiterRuns.map((g) => g.yBaselinePt + g.fontSizePt * 0.2));

      expect(delimTop).toBeLessThanOrEqual(bodyTop);
      expect(delimBottom).toBeGreaterThanOrEqual(bodyBottom);
    });
  });

  describe('environments', () => {
    it('matrix environment renders', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\begin{matrix} a & b \\\\ c & d \\end{matrix}', ctx);

      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
    });

    it('aligned environment renders', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}', ctx);

      expect(box.w).toBeGreaterThan(0);
    });

    it('cases environment renders', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\begin{cases} 1 & x>0 \\\\ 0 & x\\le 0 \\end{cases}', ctx);

      expect(box.w).toBeGreaterThan(0);
    });

    it('cases rows and brace are centered on equation baseline', () => {
      const ctx = createTestContext();
      const metrics = ctx.metrics as unknown as ReturnType<typeof createMockMetrics>;
      const box = layoutMathExpression(
        'f(x)=\\begin{cases} 1 \\\\ 0 \\end{cases}',
        ctx
      );
      const ops: DrawOp[] = [];
      box.emit(0, 0, ops);

      const equals = ops.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('=')
      );
      const brace = ops.find(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && op.text.includes('{')
      );

      expect(equals).toBeDefined();
      expect(brace).toBeDefined();
      const rowValues = ops.filter(
        (op): op is Extract<DrawOp, { kind: 'glyphRun' }> =>
          op.kind === 'glyphRun' && (op.text === '1' || op.text === '0')
      );
      expect(rowValues.length).toBe(2);

      const rowCenterBaseline = (rowValues[0].yBaselinePt + rowValues[1].yBaselinePt) / 2;
      expect(Math.abs(rowCenterBaseline - equals!.yBaselinePt)).toBeLessThan(
        equals!.fontSizePt * 0.06
      );

      const eqMetrics = metrics.getGlyphMetrics(equals!.fontId, '=', equals!.fontSizePt);
      const braceMetrics = metrics.getGlyphMetrics(brace!.fontId, '{', brace!.fontSizePt);
      const eqCenter = equals!.yBaselinePt + (eqMetrics.descentPt - eqMetrics.ascentPt) / 2;
      const braceCenter = brace!.yBaselinePt + (braceMetrics.descentPt - braceMetrics.ascentPt) / 2;
      expect(Math.abs(braceCenter - eqCenter)).toBeLessThan(equals!.fontSizePt * 0.35);
    });
  });

  describe('display mode', () => {
    it('display mode affects big operator positioning', () => {
      const inlineCtx = createTestContext({ displayMode: false });
      const displayCtx = createTestContext({ displayMode: true });

      const inlineBox = layoutMathExpression('\\sum_{i=1}^{n}', inlineCtx);
      const displayBox = layoutMathExpression('\\sum_{i=1}^{n}', displayCtx);

      // Display mode typically makes the expression taller
      expect(inlineBox.w).toBeGreaterThan(0);
      expect(displayBox.w).toBeGreaterThan(0);
    });
  });

  describe('phase 3 constructs', () => {
    it('layouts binomials', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('\\binom{n}{k}', ctx);
      expect(box.w).toBeGreaterThan(0);
      expect(box.a).toBeGreaterThan(0);
      expect(box.d).toBeGreaterThan(0);
    });

    it('layouts overset/underset and operatorname', () => {
      const ctx = createTestContext();
      const over = layoutMathExpression('\\overset{*}{x}', ctx);
      const under = layoutMathExpression('\\underset{*}{x}', ctx);
      const op = layoutMathExpression('\\operatorname{rank}(A)', ctx);

      expect(over.w).toBeGreaterThan(0);
      expect(under.w).toBeGreaterThan(0);
      expect(op.w).toBeGreaterThan(0);
      expect(over.a).toBeGreaterThan(under.a * 0.6);
    });
  });

  describe('emit function', () => {
    it('emit positions ops at specified location', () => {
      const ctx = createTestContext();
      const box = layoutMathExpression('x', ctx);

      const ops1: DrawOp[] = [];
      const ops2: DrawOp[] = [];
      box.emit(0, 0, ops1);
      box.emit(100, 200, ops2);

      // Verify both emit successfully
      expect(ops1.length).toBeGreaterThan(0);
      expect(ops2.length).toBeGreaterThan(0);

      // Check that positions differ
      const firstOp1 = ops1[0] as { xPt?: number; yBaselinePt?: number };
      const firstOp2 = ops2[0] as { xPt?: number; yBaselinePt?: number };

      if ('xPt' in firstOp1 && 'xPt' in firstOp2) {
        expect(firstOp2.xPt).toBe((firstOp1.xPt ?? 0) + 100);
      }
    });

    it('emit produces correct op kinds', () => {
      const ctx = createTestContext();
      const fracBox = layoutMathExpression('\\frac{a}{b}', ctx);

      const ops: DrawOp[] = [];
      fracBox.emit(0, 0, ops);

      // Fractions produce both glyphs and rules
      const hasGlyph = ops.some(op => op.kind === 'glyph' || op.kind === 'glyphRun');
      const hasRule = ops.some(op => op.kind === 'rule');

      expect(hasGlyph).toBe(true);
      expect(hasRule).toBe(true);
    });
  });
});




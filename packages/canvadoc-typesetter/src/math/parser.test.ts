import { describe, it, expect } from 'vitest';
import { parseMath } from './parser';
import type { MathNode } from './ast';

describe('parseMath', () => {
  describe('symbols', () => {
    it('parses single letter', () => {
      expect(parseMath('x')).toEqual({ kind: 'symbol', value: 'x' });
    });

    it('parses single digit', () => {
      expect(parseMath('5')).toEqual({ kind: 'symbol', value: '5' });
    });

    it('parses operator', () => {
      expect(parseMath('+')).toEqual({ kind: 'symbol', value: '+' });
    });

    it('parses multiple symbols as a row', () => {
      const result = parseMath('xy');
      expect(result).toEqual({
        kind: 'row',
        children: [
          { kind: 'symbol', value: 'x' },
          { kind: 'symbol', value: 'y' },
        ],
      });
    });
  });

  describe('Greek letters', () => {
    it('parses lowercase Greek letters', () => {
      expect(parseMath('\\alpha')).toEqual({ kind: 'symbol', value: '\u03B1' });
      expect(parseMath('\\beta')).toEqual({ kind: 'symbol', value: '\u03B2' });
      expect(parseMath('\\gamma')).toEqual({ kind: 'symbol', value: '\u03B3' });
      expect(parseMath('\\delta')).toEqual({ kind: 'symbol', value: '\u03B4' });
      expect(parseMath('\\pi')).toEqual({ kind: 'symbol', value: '\u03C0' });
      expect(parseMath('\\omega')).toEqual({ kind: 'symbol', value: '\u03C9' });
    });

    it('parses uppercase Greek letters', () => {
      expect(parseMath('\\Gamma')).toEqual({ kind: 'symbol', value: '\u0393' });
      expect(parseMath('\\Delta')).toEqual({ kind: 'symbol', value: '\u0394' });
      expect(parseMath('\\Sigma')).toEqual({ kind: 'symbol', value: '\u03A3' });
      expect(parseMath('\\Omega')).toEqual({ kind: 'symbol', value: '\u03A9' });
    });
  });

  describe('operators and symbols', () => {
    it('parses arithmetic operators', () => {
      expect(parseMath('\\pm')).toEqual({ kind: 'symbol', value: '\u00B1' });
      expect(parseMath('\\times')).toEqual({ kind: 'symbol', value: '\u00D7' });
      expect(parseMath('\\cdot')).toEqual({ kind: 'symbol', value: '\u00B7' });
      expect(parseMath('\\div')).toEqual({ kind: 'symbol', value: '\u00F7' });
    });

    it('parses comparison operators', () => {
      expect(parseMath('\\le')).toEqual({ kind: 'symbol', value: '\u2264' });
      expect(parseMath('\\ge')).toEqual({ kind: 'symbol', value: '\u2265' });
      expect(parseMath('\\neq')).toEqual({ kind: 'symbol', value: '\u2260' });
      expect(parseMath('\\approx')).toEqual({ kind: 'symbol', value: '\u2248' });
    });

    it('parses logic symbols', () => {
      expect(parseMath('\\forall')).toEqual({ kind: 'symbol', value: '\u2200' });
      expect(parseMath('\\exists')).toEqual({ kind: 'symbol', value: '\u2203' });
      expect(parseMath('\\land')).toEqual({ kind: 'symbol', value: '\u2227' });
      expect(parseMath('\\lor')).toEqual({ kind: 'symbol', value: '\u2228' });
    });

    it('parses set theory symbols', () => {
      expect(parseMath('\\in')).toEqual({ kind: 'symbol', value: '\u2208' });
      expect(parseMath('\\subset')).toEqual({ kind: 'symbol', value: '\u2282' });
      expect(parseMath('\\cup')).toEqual({ kind: 'symbol', value: '\u222A' });
      expect(parseMath('\\cap')).toEqual({ kind: 'symbol', value: '\u2229' });
      expect(parseMath('\\emptyset')).toEqual({ kind: 'symbol', value: '\u2205' });
    });

    it('parses arrows', () => {
      expect(parseMath('\\to')).toEqual({ kind: 'symbol', value: '\u2192' });
      expect(parseMath('\\rightarrow')).toEqual({ kind: 'symbol', value: '\u2192' });
      expect(parseMath('\\leftarrow')).toEqual({ kind: 'symbol', value: '\u2190' });
      expect(parseMath('\\Rightarrow')).toEqual({ kind: 'symbol', value: '\u21D2' });
      expect(parseMath('\\mapsto')).toEqual({ kind: 'symbol', value: '\u21A6' });
    });

    it('parses calculus symbols', () => {
      expect(parseMath('\\nabla')).toEqual({ kind: 'symbol', value: '\u2207' });
      expect(parseMath('\\partial')).toEqual({ kind: 'symbol', value: '\u2202' });
      expect(parseMath('\\infty')).toEqual({ kind: 'symbol', value: '\u221E' });
    });

    it('parses big operators', () => {
      expect(parseMath('\\sum')).toEqual({ kind: 'symbol', value: '\u2211' });
      expect(parseMath('\\prod')).toEqual({ kind: 'symbol', value: '\u220F' });
      expect(parseMath('\\int')).toEqual({ kind: 'symbol', value: '\u222B' });
      expect(parseMath('\\bigcup')).toEqual({ kind: 'symbol', value: '\u22C3' });
    });
  });

  describe('grouping', () => {
    it('parses simple group', () => {
      expect(parseMath('{x}')).toEqual({ kind: 'symbol', value: 'x' });
    });

    it('parses nested groups', () => {
      expect(parseMath('{{x}}')).toEqual({ kind: 'symbol', value: 'x' });
    });

    it('parses group with multiple items', () => {
      expect(parseMath('{ab}')).toEqual({
        kind: 'row',
        children: [
          { kind: 'symbol', value: 'a' },
          { kind: 'symbol', value: 'b' },
        ],
      });
    });
  });

  describe('superscripts and subscripts', () => {
    it('parses superscript', () => {
      expect(parseMath('x^2')).toEqual({
        kind: 'supsub',
        base: { kind: 'symbol', value: 'x' },
        sup: { kind: 'symbol', value: '2' },
        sub: undefined,
      });
    });

    it('parses subscript', () => {
      expect(parseMath('x_i')).toEqual({
        kind: 'supsub',
        base: { kind: 'symbol', value: 'x' },
        sup: undefined,
        sub: { kind: 'symbol', value: 'i' },
      });
    });

    it('parses both superscript and subscript', () => {
      expect(parseMath('x_i^2')).toEqual({
        kind: 'supsub',
        base: { kind: 'symbol', value: 'x' },
        sup: { kind: 'symbol', value: '2' },
        sub: { kind: 'symbol', value: 'i' },
      });
    });

    it('parses grouped superscript', () => {
      expect(parseMath('x^{10}')).toEqual({
        kind: 'supsub',
        base: { kind: 'symbol', value: 'x' },
        sup: {
          kind: 'row',
          children: [
            { kind: 'symbol', value: '1' },
            { kind: 'symbol', value: '0' },
          ],
        },
        sub: undefined,
      });
    });
  });

  describe('fractions', () => {
    it('parses simple fraction', () => {
      const result = parseMath('\\frac{a}{b}');
      expect(result).toEqual({
        kind: 'fraction',
        numerator: { kind: 'symbol', value: 'a' },
        denominator: { kind: 'symbol', value: 'b' },
      });
    });

    it('parses dfrac as fraction', () => {
      const result = parseMath('\\dfrac{x}{y}');
      expect(result).toEqual({
        kind: 'fraction',
        numerator: { kind: 'symbol', value: 'x' },
        denominator: { kind: 'symbol', value: 'y' },
      });
    });

    it('parses tfrac as fraction', () => {
      const result = parseMath('\\tfrac{1}{2}');
      expect(result).toEqual({
        kind: 'fraction',
        numerator: { kind: 'symbol', value: '1' },
        denominator: { kind: 'symbol', value: '2' },
      });
    });

    it('parses nested fractions', () => {
      const result = parseMath('\\frac{\\frac{a}{b}}{c}');
      expect(result).toEqual({
        kind: 'fraction',
        numerator: {
          kind: 'fraction',
          numerator: { kind: 'symbol', value: 'a' },
          denominator: { kind: 'symbol', value: 'b' },
        },
        denominator: { kind: 'symbol', value: 'c' },
      });
    });

    it('parses binomial coefficients', () => {
      const result = parseMath('\\binom{n}{k}');
      expect(result).toEqual({
        kind: 'binom',
        upper: { kind: 'symbol', value: 'n' },
        lower: { kind: 'symbol', value: 'k' },
      });
    });
  });

  describe('square roots', () => {
    it('parses simple sqrt', () => {
      const result = parseMath('\\sqrt{x}');
      expect(result).toEqual({
        kind: 'sqrt',
        body: { kind: 'symbol', value: 'x' },
        degree: undefined,
      });
    });

    it('parses nth root', () => {
      const result = parseMath('\\sqrt[3]{x}');
      expect(result).toEqual({
        kind: 'sqrt',
        body: { kind: 'symbol', value: 'x' },
        degree: { kind: 'symbol', value: '3' },
      });
    });
  });

  describe('delimiters', () => {
    it('parses \\left...\\right parentheses', () => {
      const result = parseMath('\\left( x \\right)');
      expect(result).toEqual({
        kind: 'delimited',
        left: '(',
        right: ')',
        body: { kind: 'symbol', value: 'x' },
      });
    });

    it('parses \\left...\\right with dot delimiter', () => {
      const result = parseMath('\\left. x \\right|');
      expect(result).toEqual({
        kind: 'delimited',
        left: '',
        right: '|',
        body: { kind: 'symbol', value: 'x' },
      });
    });

    it('parses \\left...\\right with angle brackets', () => {
      const result = parseMath('\\left\\langle x \\right\\rangle');
      expect(result).toEqual({
        kind: 'delimited',
        left: '\u27E8',
        right: '\u27E9',
        body: { kind: 'symbol', value: 'x' },
      });
    });
  });

  describe('environments', () => {
    it('parses aligned environment', () => {
      const result = parseMath('\\begin{aligned} x &= 1 \\end{aligned}');
      expect(result).toEqual({
        kind: 'environment',
        name: 'aligned',
        body: 'x &= 1',
      });
    });

    it('parses matrix environment', () => {
      const result = parseMath('\\begin{matrix} a & b \\\\ c & d \\end{matrix}');
      expect(result).toEqual({
        kind: 'environment',
        name: 'matrix',
        body: 'a & b \\\\ c & d',
      });
    });

    it('parses cases environment', () => {
      const result = parseMath('\\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}');
      expect(result).toEqual({
        kind: 'environment',
        name: 'cases',
        body: '1 & x > 0 \\\\ 0 & x \\le 0',
      });
    });
  });

  describe('style commands', () => {
    it('parses \\mathrm', () => {
      const result = parseMath('\\mathrm{sin}');
      expect(result).toEqual({
        kind: 'style',
        style: 'mathrm',
        body: {
          kind: 'row',
          children: [
            { kind: 'symbol', value: 's' },
            { kind: 'symbol', value: 'i' },
            { kind: 'symbol', value: 'n' },
          ],
        },
      });
    });

    it('parses \\mathbb', () => {
      const result = parseMath('\\mathbb{R}');
      expect(result).toEqual({
        kind: 'style',
        style: 'mathbb',
        body: { kind: 'symbol', value: 'R' },
      });
    });
  });

  describe('text', () => {
    it('parses \\text command', () => {
      const result = parseMath('\\text{hello}');
      expect(result).toEqual({
        kind: 'text',
        value: 'hello',
      });
    });

    it('parses \\operatorname command', () => {
      const result = parseMath('\\operatorname{rank}');
      expect(result).toEqual({
        kind: 'operatorname',
        name: 'rank',
      });
    });
  });

  describe('over/under annotations', () => {
    it('parses \\overset', () => {
      const result = parseMath('\\overset{a}{b}');
      expect(result).toEqual({
        kind: 'overunder',
        base: { kind: 'symbol', value: 'b' },
        over: { kind: 'symbol', value: 'a' },
      });
    });

    it('parses \\underset', () => {
      const result = parseMath('\\underset{a}{b}');
      expect(result).toEqual({
        kind: 'overunder',
        base: { kind: 'symbol', value: 'b' },
        under: { kind: 'symbol', value: 'a' },
      });
    });

    it('parses \\stackrel as overset alias', () => {
      const result = parseMath('\\stackrel{a}{\\to}');
      expect(result).toEqual({
        kind: 'overunder',
        base: { kind: 'symbol', value: '\u2192' },
        over: { kind: 'symbol', value: 'a' },
      });
    });
  });

  describe('spacing', () => {
    it('parses thin space', () => {
      expect(parseMath('\\,')).toEqual({ kind: 'space', amount: 'thin' });
    });

    it('parses medium space', () => {
      expect(parseMath('\\:')).toEqual({ kind: 'space', amount: 'medium' });
    });

    it('parses thick space', () => {
      expect(parseMath('\\;')).toEqual({ kind: 'space', amount: 'thick' });
    });

    it('parses quad space', () => {
      expect(parseMath('\\quad')).toEqual({ kind: 'space', amount: 'quad' });
    });

    it('parses qquad space', () => {
      expect(parseMath('\\qquad')).toEqual({ kind: 'space', amount: 'qquad' });
    });
  });

  describe('complex expressions', () => {
    it('parses expression with fraction and superscript', () => {
      const result = parseMath('\\frac{x^2}{y}');
      expect(result).toEqual({
        kind: 'fraction',
        numerator: {
          kind: 'supsub',
          base: { kind: 'symbol', value: 'x' },
          sup: { kind: 'symbol', value: '2' },
          sub: undefined,
        },
        denominator: { kind: 'symbol', value: 'y' },
      });
    });

    it('parses quadratic formula', () => {
      const result = parseMath('\\frac{-b \\pm \\sqrt{b^2}}{2a}');
      expect(result.kind).toBe('fraction');
    });
  });

  describe('error handling', () => {
    it('throws on unmatched brace', () => {
      expect(() => parseMath('{x')).toThrow();
    });

    it('throws on unmatched \\left without \\right', () => {
      expect(() => parseMath('\\left( x')).toThrow();
    });
  });
});

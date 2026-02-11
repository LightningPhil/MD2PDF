import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks } from './markdown';
import { parseMath } from './math/parser';

/**
 * Snapshot/parity tests for layout output structure.
 * These tests verify that:
 * 1. The output structure is consistent (snapshot tests)
 * 2. The same input always produces the same output (determinism)
 */

describe('Markdown Parser Snapshots', () => {
  describe('paragraphs structure', () => {
    it('single paragraph snapshot', () => {
      const result = parseMarkdownBlocks('Hello world.');
      expect(result).toMatchSnapshot();
    });

    it('multiple paragraphs snapshot', () => {
      const result = parseMarkdownBlocks('First paragraph.\n\nSecond paragraph.\n\nThird.');
      expect(result).toMatchSnapshot();
    });
  });

  describe('headings structure', () => {
    it('all heading levels snapshot', () => {
      const result = parseMarkdownBlocks('# H1\n## H2\n### H3');
      expect(result).toMatchSnapshot();
    });
  });

  describe('lists structure', () => {
    it('unordered list snapshot', () => {
      const result = parseMarkdownBlocks('- Item one\n- Item two\n- Item three');
      expect(result).toMatchSnapshot();
    });

    it('ordered list snapshot', () => {
      const result = parseMarkdownBlocks('1. First\n2. Second\n3. Third');
      expect(result).toMatchSnapshot();
    });

    it('nested mixed list snapshot', () => {
      const result = parseMarkdownBlocks('- Top\n  1. Child\n  2. Child two\n- Bottom');
      expect(result).toMatchSnapshot();
    });
  });

  describe('blockquote and hard break structure', () => {
    it('blockquote snapshot', () => {
      const result = parseMarkdownBlocks('> line one\n>> line two\n> line three');
      expect(result).toMatchSnapshot();
    });

    it('hard line break snapshot', () => {
      const result = parseMarkdownBlocks('line one  \nline two');
      expect(result).toMatchSnapshot();
    });
  });

  describe('code blocks structure', () => {
    it('fenced code block snapshot', () => {
      const result = parseMarkdownBlocks('```js\nconst x = 1;\nconst y = 2;\n```');
      expect(result).toMatchSnapshot();
    });
  });

  describe('tables structure', () => {
    it('simple table snapshot', () => {
      const result = parseMarkdownBlocks('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |');
      expect(result).toMatchSnapshot();
    });

    it('aligned table snapshot', () => {
      const result = parseMarkdownBlocks('| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |');
      expect(result).toMatchSnapshot();
    });
  });

  describe('mixed content structure', () => {
    it('complex document snapshot', () => {
      const markdown = `# Title

Introduction paragraph with some text.

## Section One

- Item A
- Item B

\`\`\`python
def hello():
    print("Hi")
\`\`\`

| Name | Value |
| --- | --- |
| x | 10 |

$$E = mc^2$$`;
      const result = parseMarkdownBlocks(markdown);
      expect(result).toMatchSnapshot();
    });
  });
});

describe('Math Parser Snapshots', () => {
  describe('simple expressions', () => {
    it('variables snapshot', () => {
      const result = parseMath('xyz');
      expect(result).toMatchSnapshot();
    });

    it('numbers snapshot', () => {
      const result = parseMath('123');
      expect(result).toMatchSnapshot();
    });
  });

  describe('Greek letters', () => {
    it('common Greek letters snapshot', () => {
      const result = parseMath('\\alpha + \\beta + \\gamma');
      expect(result).toMatchSnapshot();
    });
  });

  describe('fractions', () => {
    it('simple fraction snapshot', () => {
      const result = parseMath('\\frac{a}{b}');
      expect(result).toMatchSnapshot();
    });

    it('nested fraction snapshot', () => {
      const result = parseMath('\\frac{\\frac{a}{b}}{c}');
      expect(result).toMatchSnapshot();
    });

    it('binom snapshot', () => {
      const result = parseMath('\\binom{n}{k}');
      expect(result).toMatchSnapshot();
    });
  });

  describe('superscripts and subscripts', () => {
    it('combined sup sub snapshot', () => {
      const result = parseMath('x_i^2 + y_j^3');
      expect(result).toMatchSnapshot();
    });
  });

  describe('square roots', () => {
    it('sqrt snapshot', () => {
      const result = parseMath('\\sqrt{x^2 + y^2}');
      expect(result).toMatchSnapshot();
    });

    it('nth root snapshot', () => {
      const result = parseMath('\\sqrt[3]{x}');
      expect(result).toMatchSnapshot();
    });
  });

  describe('environments', () => {
    it('matrix snapshot', () => {
      const result = parseMath('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
      expect(result).toMatchSnapshot();
    });
  });

  describe('complex expressions', () => {
    it('quadratic formula snapshot', () => {
      const result = parseMath('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
      expect(result).toMatchSnapshot();
    });

    it('summation snapshot', () => {
      const result = parseMath('\\sum_{i=1}^{n} x_i');
      expect(result).toMatchSnapshot();
    });

    it('integral snapshot', () => {
      const result = parseMath('\\int_0^\\infty e^{-x^2} dx');
      expect(result).toMatchSnapshot();
    });

    it('overset/operatorname snapshot', () => {
      const result = parseMath('\\operatorname{rank}(A) + \\overset{*}{x}');
      expect(result).toMatchSnapshot();
    });
  });
});

describe('Determinism Tests', () => {
  describe('markdown determinism', () => {
    it('same markdown input always produces identical output', () => {
      const markdown = `# Test Document

This is a paragraph with some **content**.

- List item 1
- List item 2

| Col1 | Col2 |
| --- | --- |
| A | B |`;

      // Parse multiple times
      const results = Array.from({ length: 5 }, () => parseMarkdownBlocks(markdown));

      // All results should be identical
      const serialized = results.map((r) => JSON.stringify(r));
      expect(new Set(serialized).size).toBe(1);
    });

    it('different markdown produces different output', () => {
      const result1 = parseMarkdownBlocks('# Heading One');
      const result2 = parseMarkdownBlocks('# Heading Two');

      expect(JSON.stringify(result1)).not.toBe(JSON.stringify(result2));
    });
  });

  describe('math determinism', () => {
    it('same math input always produces identical AST', () => {
      const expr = '\\frac{x^2 + y^2}{\\sqrt{z}}';

      // Parse multiple times
      const results = Array.from({ length: 5 }, () => parseMath(expr));

      // All results should be identical
      const serialized = results.map((r) => JSON.stringify(r));
      expect(new Set(serialized).size).toBe(1);
    });

    it('order-sensitive operations are stable', () => {
      const expr = 'a + b + c + d + e';

      const results = Array.from({ length: 10 }, () => parseMath(expr));
      const serialized = results.map((r) => JSON.stringify(r));

      expect(new Set(serialized).size).toBe(1);
    });

    it('complex nested expression is deterministic', () => {
      const expr = '\\left( \\sum_{i=1}^{n} \\frac{x_i^2}{y_i} \\right)';

      const results = Array.from({ length: 5 }, () => parseMath(expr));
      const serialized = results.map((r) => JSON.stringify(r));

      expect(new Set(serialized).size).toBe(1);
    });
  });

  describe('hash consistency', () => {
    it('can compute stable hash from markdown output', () => {
      const markdown = '# Title\n\nContent here.';
      const result = parseMarkdownBlocks(markdown);
      const hash = simpleHash(JSON.stringify(result));

      // Hash should be consistent
      for (let i = 0; i < 5; i++) {
        const newResult = parseMarkdownBlocks(markdown);
        const newHash = simpleHash(JSON.stringify(newResult));
        expect(newHash).toBe(hash);
      }
    });

    it('can compute stable hash from math output', () => {
      const expr = '\\frac{a}{b}';
      const result = parseMath(expr);
      const hash = simpleHash(JSON.stringify(result));

      // Hash should be consistent
      for (let i = 0; i < 5; i++) {
        const newResult = parseMath(expr);
        const newHash = simpleHash(JSON.stringify(newResult));
        expect(newHash).toBe(hash);
      }
    });
  });
});

/**
 * Simple string hash function for determinism testing.
 * Not cryptographic, just for quick comparison.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

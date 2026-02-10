/**
 * Performance benchmarks for parser hot paths.
 *
 * Purpose:
 * - Track parse performance over representative markdown/math workloads.
 * - Provide a quick regression signal during development.
 *
 * Usage:
 * - Run via `pnpm run test:bench`.
 */
import { bench, describe } from 'vitest';
import { parseMarkdownBlocks } from './markdown';
import { parseMath } from './math/parser';

// Generate sample documents
const generateMarkdown = (paragraphs: number): string => {
  const lines: string[] = ['# Sample Document', ''];

  for (let i = 0; i < paragraphs; i++) {
    lines.push(`## Section ${i + 1}`);
    lines.push('');
    lines.push(
      `This is paragraph ${i + 1} with some sample text that would be typical in a document. ` +
        'It contains multiple sentences to simulate realistic content. ' +
        'The purpose is to test parsing and layout performance.'
    );
    lines.push('');

    if (i % 3 === 0) {
      lines.push('- List item one');
      lines.push('- List item two');
      lines.push('- List item three');
      lines.push('');
    }

    if (i % 4 === 0) {
      lines.push('```');
      lines.push('const example = {');
      lines.push('  key: "value",');
      lines.push('  number: 42');
      lines.push('};');
      lines.push('```');
      lines.push('');
    }

    if (i % 5 === 0) {
      lines.push('| Column A | Column B | Column C |');
      lines.push('| --- | --- | --- |');
      lines.push('| Data 1 | Data 2 | Data 3 |');
      lines.push('| Data 4 | Data 5 | Data 6 |');
      lines.push('');
    }
  }

  return lines.join('\n');
};

const simpleMath = 'x^2 + y^2 = z^2';
const mediumMath = '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
const complexMath =
  '\\sum_{i=1}^{n} \\frac{x_i^2}{\\sqrt{y_i}} + \\int_0^\\infty e^{-x^2} dx';
const matrixMath = '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}';
const nestedMath =
  '\\left( \\frac{\\sqrt{\\frac{a}{b}}}{\\sum_{k=1}^{\\infty} \\frac{1}{k^2}} \\right)';

const smallDoc = generateMarkdown(5); // ~1 page
const mediumDoc = generateMarkdown(20); // ~3-4 pages
const largeDoc = generateMarkdown(50); // ~8-10 pages

describe('Markdown Parser Benchmarks', () => {
  bench('parse small document (~1 page)', () => {
    parseMarkdownBlocks(smallDoc);
  });

  bench('parse medium document (~3-4 pages)', () => {
    parseMarkdownBlocks(mediumDoc);
  });

  bench('parse large document (~8-10 pages)', () => {
    parseMarkdownBlocks(largeDoc);
  });

  bench('parse document with many tables', () => {
    const tables = Array(20)
      .fill(null)
      .map(
        (_, i) =>
          `| Header ${i} | Value |\n| --- | --- |\n| Row 1 | Data 1 |\n| Row 2 | Data 2 |`
      )
      .join('\n\n');
    parseMarkdownBlocks(tables);
  });

  bench('parse document with many code blocks', () => {
    const codeBlocks = Array(20)
      .fill(null)
      .map((_, i) => `\`\`\`javascript\nconst value${i} = ${i};\nconsole.log(value${i});\n\`\`\``)
      .join('\n\n');
    parseMarkdownBlocks(codeBlocks);
  });
});

describe('Math Parser Benchmarks', () => {
  bench('parse simple expression', () => {
    parseMath(simpleMath);
  });

  bench('parse medium expression (quadratic formula)', () => {
    parseMath(mediumMath);
  });

  bench('parse complex expression (sum + integral)', () => {
    parseMath(complexMath);
  });

  bench('parse matrix', () => {
    parseMath(matrixMath);
  });

  bench('parse deeply nested expression', () => {
    parseMath(nestedMath);
  });

  bench('parse 100 simple expressions', () => {
    for (let i = 0; i < 100; i++) {
      parseMath(simpleMath);
    }
  });

  bench('parse 100 complex expressions', () => {
    for (let i = 0; i < 100; i++) {
      parseMath(complexMath);
    }
  });
});

describe('Combined Parsing Benchmarks', () => {
  const docWithMath = `# Mathematics Document

The quadratic formula is $${mediumMath}$.

For sums we use:
$$${complexMath}$$

And matrices:
$$${matrixMath}$$

More content follows with inline math like $x^2$ and $\\alpha + \\beta$.`;

  bench('parse document with inline and display math', () => {
    parseMarkdownBlocks(docWithMath);
  });

  bench('parse 10 documents with math', () => {
    for (let i = 0; i < 10; i++) {
      parseMarkdownBlocks(docWithMath);
    }
  });
});

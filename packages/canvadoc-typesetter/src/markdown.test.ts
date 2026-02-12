import { describe, it, expect } from 'vitest';
import { parseMarkdownBlocks, type TableAlign } from './markdown';

describe('parseMarkdownBlocks', () => {
  describe('paragraphs', () => {
    it('parses a simple paragraph', () => {
      const result = parseMarkdownBlocks('Hello world.');
      expect(result).toEqual([{ kind: 'paragraph', text: 'Hello world.' }]);
    });

    it('merges multiple lines into one paragraph', () => {
      const result = parseMarkdownBlocks('Line one\nLine two\nLine three');
      expect(result).toEqual([{ kind: 'paragraph', text: 'Line one Line two Line three' }]);
    });

    it('separates paragraphs by blank lines', () => {
      const result = parseMarkdownBlocks('Paragraph one.\n\nParagraph two.');
      expect(result).toEqual([
        { kind: 'paragraph', text: 'Paragraph one.' },
        { kind: 'paragraph', text: 'Paragraph two.' },
      ]);
    });

    it('handles CRLF line endings', () => {
      const result = parseMarkdownBlocks('Line one\r\nLine two');
      expect(result).toEqual([{ kind: 'paragraph', text: 'Line one Line two' }]);
    });

    it('preserves hard line breaks from two trailing spaces', () => {
      const result = parseMarkdownBlocks('Line one  \nLine two');
      expect(result).toEqual([{ kind: 'paragraph', text: 'Line one\nLine two' }]);
    });
  });

  describe('headings', () => {
    it('parses level 1 heading', () => {
      const result = parseMarkdownBlocks('# Title');
      expect(result).toEqual([{ kind: 'heading', level: 1, text: 'Title' }]);
    });

    it('parses level 2 heading', () => {
      const result = parseMarkdownBlocks('## Subtitle');
      expect(result).toEqual([{ kind: 'heading', level: 2, text: 'Subtitle' }]);
    });

    it('parses level 3 heading', () => {
      const result = parseMarkdownBlocks('### Section');
      expect(result).toEqual([{ kind: 'heading', level: 3, text: 'Section' }]);
    });

    it('trims heading text', () => {
      const result = parseMarkdownBlocks('#   Spaced Heading   ');
      expect(result).toEqual([{ kind: 'heading', level: 1, text: 'Spaced Heading' }]);
    });
  });

  describe('lists', () => {
    it('parses unordered list', () => {
      const result = parseMarkdownBlocks('- Item one\n- Item two\n- Item three');
      expect(result).toEqual([
        { kind: 'list', ordered: false, items: ['Item one', 'Item two', 'Item three'] },
      ]);
    });

    it('parses ordered list', () => {
      const result = parseMarkdownBlocks('1. First\n2. Second\n3. Third');
      expect(result).toEqual([
        { kind: 'list', ordered: true, items: ['First', 'Second', 'Third'] },
      ]);
    });

    it('handles non-sequential numbered lists', () => {
      const result = parseMarkdownBlocks('1. First\n5. Second\n100. Third');
      expect(result).toEqual([
        { kind: 'list', ordered: true, items: ['First', 'Second', 'Third'] },
      ]);
    });

    it('parses nested mixed lists up to depth 2 metadata', () => {
      const result = parseMarkdownBlocks('- Top\n  1. Child one\n  2. Child two\n- Bottom');
      expect(result).toEqual([
        {
          kind: 'list',
          ordered: false,
          items: ['Top', 'Child one', 'Child two', 'Bottom'],
          itemDepths: [0, 1, 1, 0],
          itemKinds: ['unordered', 'ordered', 'ordered', 'unordered'],
          itemNumbers: [null, 1, 2, null],
        },
      ]);
    });
  });

  describe('blockquotes', () => {
    it('parses single-depth blockquote lines as one block', () => {
      const result = parseMarkdownBlocks('> quoted line\n> next line');
      expect(result).toEqual([
        { kind: 'blockquote', depth: 1, text: 'quoted line next line' },
      ]);
    });

    it('splits blockquotes when depth changes', () => {
      const result = parseMarkdownBlocks('> level one\n>> level two\n> back one');
      expect(result).toEqual([
        { kind: 'blockquote', depth: 1, text: 'level one' },
        { kind: 'blockquote', depth: 2, text: 'level two' },
        { kind: 'blockquote', depth: 1, text: 'back one' },
      ]);
    });
  });

  describe('code blocks', () => {
    it('parses fenced code block', () => {
      const result = parseMarkdownBlocks('```\nconst x = 1;\nconst y = 2;\n```');
      expect(result).toEqual([{ kind: 'code', lines: ['const x = 1;', 'const y = 2;'] }]);
    });

    it('parses code block with language tag', () => {
      const result = parseMarkdownBlocks('```javascript\nconsole.log("hi");\n```');
      expect(result).toEqual([{ kind: 'code', lines: ['console.log("hi");'] }]);
    });

    it('preserves indentation in code blocks', () => {
      const result = parseMarkdownBlocks('```\n  indented\n    more\n```');
      expect(result).toEqual([{ kind: 'code', lines: ['  indented', '    more'] }]);
    });
  });

  describe('display math', () => {
    it('parses multi-line display math', () => {
      const result = parseMarkdownBlocks('$$\nx^2 + y^2 = z^2\n$$');
      expect(result).toEqual([{ kind: 'displayMath', expr: 'x^2 + y^2 = z^2' }]);
    });

    it('parses single-line display math', () => {
      const result = parseMarkdownBlocks('$$E = mc^2$$');
      expect(result).toEqual([{ kind: 'displayMath', expr: 'E = mc^2' }]);
    });

    it('handles multi-line display math with multiple expressions', () => {
      const result = parseMarkdownBlocks('$$\na + b\nc + d\n$$');
      expect(result).toEqual([{ kind: 'displayMath', expr: 'a + b c + d' }]);
    });
  });

  describe('horizontal rules', () => {
    it('parses horizontal rule', () => {
      const result = parseMarkdownBlocks('---');
      expect(result).toEqual([{ kind: 'hr' }]);
    });

    it('handles hr between content', () => {
      const result = parseMarkdownBlocks('Above\n\n---\n\nBelow');
      expect(result).toEqual([
        { kind: 'paragraph', text: 'Above' },
        { kind: 'hr' },
        { kind: 'paragraph', text: 'Below' },
      ]);
    });
  });

  describe('tables', () => {
    it('parses simple table', () => {
      const result = parseMarkdownBlocks(
        '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |'
      );
      expect(result).toEqual([
        {
          kind: 'table',
          header: ['Name', 'Age'],
          align: ['left', 'left'],
          rows: [
            ['Alice', '30'],
            ['Bob', '25'],
          ],
        },
      ]);
    });

    it('parses table with alignment markers', () => {
      const result = parseMarkdownBlocks(
        '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |'
      );
      expect(result).toEqual([
        {
          kind: 'table',
          header: ['Left', 'Center', 'Right'],
          align: ['left', 'center', 'right'] as TableAlign[],
          rows: [['a', 'b', 'c']],
        },
      ]);
    });

    it('handles missing cells by filling with empty strings', () => {
      const result = parseMarkdownBlocks('| A | B | C |\n| --- | --- | --- |\n| 1 |');
      expect(result).toEqual([
        {
          kind: 'table',
          header: ['A', 'B', 'C'],
          align: ['left', 'left', 'left'],
          rows: [['1', '', '']],
        },
      ]);
    });

    it('handles table without leading/trailing pipes', () => {
      const result = parseMarkdownBlocks('Name | Age\n--- | ---\nAlice | 30');
      expect(result).toEqual([
        {
          kind: 'table',
          header: ['Name', 'Age'],
          align: ['left', 'left'],
          rows: [['Alice', '30']],
        },
      ]);
    });
  });

  describe('source spans', () => {
    it('can attach source spans to headings and paragraphs', () => {
      const markdown = '# Title\n\nBody line';
      const result = parseMarkdownBlocks(markdown, { includeSourceSpans: true });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        kind: 'heading',
        sourceSpan: { start: 0, end: 7, kind: 'markdown' },
      });
      expect(result[1]).toMatchObject({
        kind: 'paragraph',
        sourceSpan: { start: 9, end: 18, kind: 'markdown' },
      });
    });

    it('tracks per-item source spans for lists', () => {
      const markdown = '- one\n  2. two\n- three';
      const result = parseMarkdownBlocks(markdown, { includeSourceSpans: true });
      const list = result[0];

      expect(list?.kind).toBe('list');
      if (list?.kind !== 'list') {
        return;
      }

      expect(list.itemSourceSpans).toHaveLength(3);
      expect(list.itemSourceSpans?.map((span) => span?.start)).toEqual([0, 6, 15]);
      expect(list.itemSourceSpans?.map((span) => span?.end)).toEqual([5, 14, 22]);
    });

    it('tracks header and row source spans for tables', () => {
      const markdown = '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
      const result = parseMarkdownBlocks(markdown, { includeSourceSpans: true });
      const table = result[0];

      expect(table?.kind).toBe('table');
      if (table?.kind !== 'table') {
        return;
      }

      expect(table.headerSourceSpan?.start).toBe(markdown.indexOf('| A | B |'));
      expect(table.rowSourceSpans).toHaveLength(2);
      expect(table.rowSourceSpans?.[0]?.start).toBe(markdown.indexOf('| 1 | 2 |'));
      expect(table.rowSourceSpans?.[1]?.start).toBe(markdown.indexOf('| 3 | 4 |'));
    });

    it('tracks per-line source spans for code blocks', () => {
      const markdown = '```\nalpha\nbeta\n```';
      const result = parseMarkdownBlocks(markdown, { includeSourceSpans: true });
      const code = result[0];

      expect(code?.kind).toBe('code');
      if (code?.kind !== 'code') {
        return;
      }

      expect(code.lineSourceSpans).toHaveLength(2);
      expect(code.lineSourceSpans?.[0]?.start).toBe(markdown.indexOf('alpha'));
      expect(code.lineSourceSpans?.[1]?.start).toBe(markdown.indexOf('beta'));
    });
  });

  describe('mixed content', () => {
    it('parses multiple block types correctly', () => {
      const markdown = `# Title

This is a paragraph.

- Item one
- Item two

\`\`\`
code here
\`\`\`

$$x^2$$`;
      const result = parseMarkdownBlocks(markdown);
      expect(result).toEqual([
        { kind: 'heading', level: 1, text: 'Title' },
        { kind: 'paragraph', text: 'This is a paragraph.' },
        { kind: 'list', ordered: false, items: ['Item one', 'Item two'] },
        { kind: 'code', lines: ['code here'] },
        { kind: 'displayMath', expr: 'x^2' },
      ]);
    });

    it('handles empty input', () => {
      const result = parseMarkdownBlocks('');
      expect(result).toEqual([]);
    });

    it('handles whitespace-only input', () => {
      const result = parseMarkdownBlocks('   \n\n  \n');
      expect(result).toEqual([]);
    });
  });
});

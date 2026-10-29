// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings, encodeDocument, decodeDocument } from '../src/document';
import { renderMarkdown } from '../src/markdown';
import { tableAt, tableMarkdown } from '../src/media-tools';
import { inspectOutput } from '../src/preflight';
import { equationAt } from '../src/authoring';

describe('document styles and portable metadata', () => {
  it('round-trips settings without exposing metadata in the writing source', () => {
    const settings = { ...DEFAULT_SETTINGS, title: 'A --> <script>title</script>', titlePage: true, preset: 'technical' as const };
    const encoded = encodeDocument('# Text', settings);
    expect(encoded).not.toContain('<script>');
    expect(decodeDocument(encoded)).toEqual({ content: '# Text', settings, hasSettings: true });
  });
  it('keeps unrecognized metadata intact and normalizes invalid settings', () => {
    const text = '<!-- md2pdf:broken -->\n\n# Notes';
    expect(decodeDocument(text).content).toBe(text);
    const settings = normalizeSettings({ margin: -200, fontSize: 500, accent: 'url(javascript:bad)', titlePage: 'yes' });
    expect(settings.margin).toBe(15); expect(settings.fontSize).toBe(20); expect(settings.accent).toBe(DEFAULT_SETTINGS.accent); expect(settings.titlePage).toBe(false);
  });
});
describe('structured documents', () => {
  const render = (source: string, settings = DEFAULT_SETTINGS) => renderMarkdown(source, { mathMode: { type: 'html' }, settings });
  it('numbers references in document order and updates when equations move', () => {
    const a = '$$\nx^2\n$$ {#eq:a}\n\n', b = '$$\ny^2\n$$ {#eq:b}\n\n';
    expect(render(a + b + 'See [@eq:b].').querySelector('.document-reference')!.textContent).toBe('Equation (2)');
    expect(render(b + a + 'See [@eq:b].').querySelector('.document-reference')!.textContent).toBe('Equation (1)');
  });
  it('locates labelled equations for replacement including the old label', () => {
    const source = '$$\nx^2\n$$ {#eq:power}';
    expect(equationAt(source, 4, 4)).toEqual({ start: 0, end: source.length, source: 'x^2', display: true, label: 'eq:power' });
  });
  it('numbers unlabeled display math only when enabled', () => {
    expect(render('$$x$$').querySelector('.equation-number')).toBeNull();
    expect(render('$$x$$', { ...DEFAULT_SETTINGS, numberEquations: true }).querySelector('.equation-number')!.textContent).toBe('(1)');
  });
  it('does not leave numbering gaps for equations intentionally left unnumbered', () => {
    const root = render('$$x$$\n\n$$y$$ {#eq:y}\n\nSee [@eq:y].');
    expect(root.querySelector('.equation-number')!.textContent).toBe('(1)');
    expect(root.querySelector('.document-reference')!.textContent).toBe('Equation (1)');
  });
  it('shows an identifying figure number when a labelled image has no caption', () => {
    const root = render('<figure data-label="fig:example"><img src="https://example.com/image.png" alt="Example"></figure>');
    expect(root.querySelector('figcaption')!.textContent).toBe('Figure 1.');
  });
  it('creates title and contents pages with stable heading links', () => {
    const root = render('# Introduction\n\nText\n\n## Method', { ...DEFAULT_SETTINGS, toc: true, titlePage: true, title: 'My report' });
    expect(root.querySelector('.document-title-page h1')!.textContent).toBe('My report');
    expect(root.querySelectorAll('[data-page-break]')).toHaveLength(2);
    expect(root.querySelectorAll('.document-toc a')).toHaveLength(2);
    expect(root.querySelector('.document-toc a')!.getAttribute('href')).toBe('#section-1');
  });
  it('preserves source positions, including math inside paragraphs', () => {
    const source = '# Title\n\nUse $x^2$ here.\n\nLast.';
    const root = render(source);
    expect(root.querySelector('p')!.dataset.sourceStart).toBe(String(source.indexOf('Use')));
    const math = root.querySelector<HTMLElement>('.math-inline-placeholder')!;
    expect(source.slice(Number(math.dataset.sourceStart), Number(math.dataset.sourceEnd))).toBe('$x^2$');
  });
  it('preserves reference-style Markdown links across source-mapped blocks', () => {
    const root = render('[OpenAI][site]\n\n[site]: https://openai.com');
    expect(root.querySelector('a')!.getAttribute('href')).toBe('https://openai.com');
  });
  it('sanitizes executable imported HTML while retaining image metadata', () => {
    const root = render('<figure data-label="fig:test"><img src="data:image/png;base64,aA==" onerror="alert(1)" alt="Example" style="width:50%"><figcaption>Example</figcaption></figure>\n\n<script>alert(1)</script>');
    expect(root.querySelector('script')).toBeNull(); expect(root.querySelector('img')!.getAttribute('onerror')).toBeNull();
    expect(root.querySelector('figure')!.id).toBe('fig:test'); expect(root.querySelector('figcaption')!.textContent).toBe('Figure 1. Example');
  });
  it('turns manual page break syntax into pagination markers', () => {
    expect(render('Before\n\n<!-- pagebreak -->\n\nAfter').querySelector('[data-page-break]')).not.toBeNull();
  });
  it('reports broken references, duplicate labels, and unmatched delimiters', () => {
    const source = '$$x$$ {#eq:a}\n\n$$y$$ {#eq:a}\n\nSee [@eq:missing].\n\n$$';
    const issues = inspectOutput(render(source), source);
    expect(issues.map(issue => issue.message).join(' ')).toContain('Duplicate reference label');
    expect(issues.map(issue => issue.message).join(' ')).toContain('Missing reference');
    expect(issues.map(issue => issue.message).join(' ')).toContain('unmatched');
  });
  it('ignores dollar delimiters in fenced code during output checks', () => {
    const source = '```tex\n$$\n```';
    expect(inspectOutput(render(source), source)).toEqual([]);
  });
});
describe('table grid round-trips', () => {
  it('retains alignment and literal pipes', () => {
    const text = tableMarkdown([['A', 'B'], ['one | two', 'three']], ['left', 'right'], 'Results', 'tab:results');
    const table = tableAt(text, 0)!;
    expect(table.cells).toEqual([['A', 'B'], ['one | two', 'three']]);
    expect(table.align).toEqual(['left', 'right']); expect(table.label).toBe('tab:results'); expect(table.caption).toBe('Results');
  });
  it('renders captioned tables as referenceable numbered figures', () => {
    const text = tableMarkdown([['A'], ['1']], ['center'], 'Results', 'tab:results') + 'See [@tab:results].';
    const root = renderMarkdown(text);
    expect(root.querySelector('.table-figure')!.id).toBe('tab:results');
    expect(root.querySelector('figcaption')!.textContent).toBe('Table 1. Results');
    expect(root.querySelector('.document-reference')!.textContent).toBe('Table 1');
  });
});

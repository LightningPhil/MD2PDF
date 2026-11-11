// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMath } from '../src/katex';
import { renderMarkdown } from '../src/markdown';
import { inspectOutput } from '../src/preflight';

const render = (source: string) => { const root = renderMarkdown(source); renderMath(root); return root; };
describe('safe Markdown to mathematical output', () => {
  it('renders real inline and display notation, preserving source coordinates', () => {
    const root = render('Use $x^2$ and $y$.\n\n$$\\frac{a}{b}$$');
    expect(root.querySelectorAll('.rendered-equation')).toHaveLength(3);
    expect(root.querySelectorAll('.katex-html')).toHaveLength(3);
    expect(root.querySelector('.rendered-equation')?.getAttribute('data-source-start')).toBe('4');
    expect(root.querySelector('.equation-block .katex-display')).not.toBeNull();
  });
  it('retains matrix row separators through the real renderer', () => {
    const root = render('$$\n\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}\n$$');
    expect(root.querySelector('.katex-error')).toBeNull();
    expect(root.querySelector('.katex .mtable')).not.toBeNull();
  });
  it.each(['`Example $x$ must remain literal`', '```tex\n$$x$$\n```', '~~~tex\n$x$\n~~~'])('keeps code literal: %s', source => {
    const root = render(source);
    expect(root.querySelector('code')?.textContent).toContain('$');
    expect(root.querySelector('.katex')).toBeNull();
  });
  it('retains escaped currency without interpreting it as math', () => {
    const root = render('Prices are \\$5 and \\$10.');
    expect(root.textContent).toBe('Prices are $5 and $10.\n');
    expect(root.querySelector('.katex')).toBeNull();
  });
  it.each([
    '`<img src=x onerror="document.body.dataset.auditInjection=1"> $x$`',
    '```html\n<img src=x onerror="alert(1)"> $$x$$\n```',
    '&lt;img src=x onerror="alert(1)"&gt; and $x$',
  ])('never turns escaped text into executable HTML: %s', source => {
    const root = render(source);
    expect(root.querySelector('img,script,[onerror]')).toBeNull();
    expect(root.textContent).toContain('<img');
  });
  it('retains sanitisation of imported raw HTML alongside mathematics', () => {
    const root = render('<img src=x onerror="alert(1)"><script>alert(1)</script>\n\n$x$');
    expect(root.querySelector('[onerror],script')).toBeNull();
    expect(root.querySelector('.katex')).not.toBeNull();
  });
  it('does not re-render already rendered equations', () => {
    const root = render('$x$'); const before=root.innerHTML;
    renderMath(root); expect(root.innerHTML).toBe(before);
  });
  it('keeps invalid equations readable and diagnosable', () => {
    const root = render('$\\notACommand{x}$');
    expect(root.querySelector('.katex-error')?.textContent).toBe('\\notACommand{x}');
    expect(inspectOutput(root, '').some(issue=>issue.severity==='error')).toBe(true);
  });
  it('validates display-only commands using the same placement as the renderer', () => {
    const source = '$$x=1\\tag{A}$$';
    const root = render(source);
    expect(root.querySelector('.katex-error')).toBeNull();
    expect(inspectOutput(root, source)).toEqual([]);
    expect(inspectOutput(render('$x\\tag{A}$'), '').some(issue => issue.severity === 'error')).toBe(true);
  });
  it('does not scan arbitrary DOM text or HTML attributes for dollar signs', () => {
    const root=document.createElement('div'); root.innerHTML='<p title="$x$">$y$</p>';
    const before=root.innerHTML; renderMath(root); expect(root.innerHTML).toBe(before);
  });
});

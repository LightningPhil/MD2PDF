import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMath } from '../src/katex';

const { renderToStringMock } = vi.hoisted(() => ({
  renderToStringMock: vi.fn((math: string) => `<span class="katex">${math}</span>`),
}));

vi.mock('katex', () => ({
  default: {
    renderToString: renderToStringMock,
  },
}));

describe('renderMath', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.innerHTML = '';
  });

  it('handles element with no math placeholders', () => {
    container.innerHTML = '<p>Plain text without math</p>';
    renderMath(container, 'html');
    expect(renderToStringMock).not.toHaveBeenCalled();
  });

  it('renders inline math placeholders', () => {
    container.innerHTML = '<span class="math-inline-placeholder" data-math="E%20%3D%20mc%5E2"></span>';
    renderMath(container, 'html');
    expect(renderToStringMock).toHaveBeenCalledWith(
      'E = mc^2',
      expect.objectContaining({ displayMode: false, output: 'html' }),
    );
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('renders display placeholders with preserved matrix row breaks', () => {
    const matrix = `A =
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}`;
    container.innerHTML = `<div class="math-display-placeholder" data-math="${encodeURIComponent(matrix)}"></div>`;

    renderMath(container, 'html');

    expect(renderToStringMock).toHaveBeenCalledWith(
      expect.stringContaining('1 & 2 \\\\'),
      expect.objectContaining({ displayMode: true }),
    );
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('preserves source-line metadata on replacement nodes', () => {
    container.innerHTML = '<span class="math-inline-placeholder source-line-anchor" data-math="x" data-source-line-start="4" data-source-line-end="5"></span>';

    renderMath(container, 'html');

    const replaced = container.querySelector('.source-line-anchor') as HTMLElement | null;
    expect(replaced).not.toBeNull();
    expect(replaced?.dataset.sourceLineStart).toBe('4');
    expect(replaced?.dataset.sourceLineEnd).toBe('5');
  });

  it('passes svg mode through to KaTeX options for compatibility', () => {
    container.innerHTML = '<span class="math-inline-placeholder" data-math="x"></span>';
    renderMath(container, 'svg');
    expect(renderToStringMock).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ output: 'svg' }),
    );
  });

  it('handles KaTeX rendering errors gracefully', () => {
    renderToStringMock.mockImplementationOnce(() => {
      throw new Error('Invalid LaTeX');
    });
    container.innerHTML = '<span class="math-inline-placeholder" data-math="invalid%7B"></span>';
    expect(() => renderMath(container, 'html')).not.toThrow();
  });

  it('does not render raw dollar expressions from plain HTML text', () => {
    container.innerHTML = '<p>$x$ should not be parsed here</p>';
    renderMath(container, 'html');
    expect(renderToStringMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('$x$');
  });
});

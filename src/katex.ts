import katex from 'katex';

export type MathRenderMode = 'html';

/** Only parser-identified math tokens are rendered. Surrounding code and escaped
 * text must never be reparsed as HTML after Markdown sanitisation. */
export function renderMath(root: HTMLElement, _mode: MathRenderMode = 'html'): void {
  root.querySelectorAll<HTMLElement>('.math-display-placeholder, .math-inline-placeholder').forEach(placeholder => {
    if (placeholder.closest('code, pre, .katex, .rendered-equation')) return;
    const payload = placeholder.dataset.math || '';
    let math: string;
    try { math = decodeURIComponent(payload).trim(); }
    catch { math = payload; }
    const display = placeholder.classList.contains('math-display-placeholder');
    const wrapper = document.createElement(display ? 'div' : 'span');
    for (const key of ['math', 'sourceStart', 'sourceEnd', 'label'] as const) {
      if (placeholder.dataset[key] !== undefined) wrapper.dataset[key] = placeholder.dataset[key];
    }
    wrapper.className = 'rendered-equation';
    if (display) wrapper.classList.add('katex-display');
    try {
      if (!math) throw new Error('Enter a mathematical expression.');
      wrapper.innerHTML = katex.renderToString(math, {
        displayMode: display, output: 'html', throwOnError: true, strict: false, trust: false,
      });
    } catch (error) {
      const fallback = document.createElement('span');
      fallback.className = 'katex-error';
      fallback.title = error instanceof Error ? error.message : 'Invalid equation';
      fallback.textContent = math || 'Empty equation';
      wrapper.append(fallback);
    }
    placeholder.replaceWith(wrapper);
  });
}

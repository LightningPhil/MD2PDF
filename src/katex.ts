import katex from 'katex';

export type MathRenderMode = 'html' | 'svg';

interface SourceLineDataset {
  sourceLineStart?: string;
  sourceLineEnd?: string;
}

interface RenderOptions {
  throwOnError: boolean;
  displayMode: boolean;
  output: MathRenderMode;
  strict: boolean;
  trust: boolean;
}

/**
 * Decodes math payload stored in a data attribute.
 */
function decodeMathPayload(payload: string | undefined): string {
  if (!payload) {
    return '';
  }

  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

/**
 * Renders math placeholders in the given HTML element using KaTeX.
 * Math tokenization is handled upstream in markdown rendering.
 */
export function renderMath(root: HTMLElement, mode: MathRenderMode = 'html'): void {
  const options: RenderOptions = {
    throwOnError: false,
    displayMode: false,
    output: mode,
    strict: false,
    trust: false,
  };

  const placeholders = root.querySelectorAll<HTMLElement>('.math-display-placeholder, .math-inline-placeholder');
  placeholders.forEach((placeholder) => {
    const math = decodeMathPayload(placeholder.dataset.math).trim();
    if (!math) {
      return;
    }

    const isDisplay = placeholder.classList.contains('math-display-placeholder');

    try {
      const rendered = katex.renderToString(
        math,
        {
          ...options,
          displayMode: isDisplay,
        } as unknown as Parameters<typeof katex.renderToString>[1],
      );

      const wrapper = document.createElement(isDisplay ? 'div' : 'span');
      if (isDisplay) {
        wrapper.className = 'katex-display';
      }

      copySourceLineMetadata(placeholder, wrapper);
      wrapper.innerHTML = rendered;
      placeholder.replaceWith(wrapper);
    } catch (error) {
      console.warn('Failed to render placeholder math:', math, error);
    }
  });
}

function copySourceLineMetadata(from: HTMLElement, to: HTMLElement): void {
  if (from.classList.contains('source-line-anchor')) {
    to.classList.add('source-line-anchor');
  }

  const sourceData = from.dataset as SourceLineDataset;
  if (sourceData.sourceLineStart) {
    to.dataset.sourceLineStart = sourceData.sourceLineStart;
  }

  if (sourceData.sourceLineEnd) {
    to.dataset.sourceLineEnd = sourceData.sourceLineEnd;
  }
}

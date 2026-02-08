import { marked, RendererExtension, TokenizerExtension, Tokens } from 'marked';

export interface MathMode {
  type: 'html' | 'svg';
}

export interface MarkdownOptions {
  mathMode: MathMode;
}

interface MathToken extends Tokens.Generic {
  type: 'mathDisplay' | 'mathInline';
  raw: string;
  text: string;
}

let markedConfigured = false;

function createMathToken(type: 'mathDisplay' | 'mathInline', raw: string, text: string): MathToken {
  return {
    type,
    raw,
    text,
  };
}

function encodeMathForDataAttribute(math: string): string {
  return encodeURIComponent(math);
}

const displayMathExtension: TokenizerExtension & RendererExtension = {
  name: 'mathDisplay',
  level: 'block',
  start(src: string): number | void {
    const index = src.indexOf('$$');
    if (index >= 0) {
      return index;
    }
    return undefined;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    // Capture display math blocks while preserving raw backslashes for KaTeX.
    const match = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$(?:\n|$)/.exec(src);
    if (!match) {
      return undefined;
    }
    return createMathToken('mathDisplay', match[0], match[1].trim());
  },
  renderer(token: Tokens.Generic): string {
    const mathToken = token as MathToken;
    const encoded = encodeMathForDataAttribute(mathToken.text);
    return `<div class="math-display-placeholder" data-math="${encoded}"></div>`;
  },
};

const inlineMathExtension: TokenizerExtension & RendererExtension = {
  name: 'mathInline',
  level: 'inline',
  start(src: string): number | void {
    const index = src.indexOf('$');
    if (index >= 0) {
      return index;
    }
    return undefined;
  },
  tokenizer(src: string): Tokens.Generic | undefined {
    if (!src.startsWith('$') || src.startsWith('$$')) {
      return undefined;
    }

    // Inline math: single-dollar delimiters on one line.
    const match = /^\$((?:\\\$|[^$\n])+?)\$(?!\$)/.exec(src);
    if (!match) {
      return undefined;
    }
    return createMathToken('mathInline', match[0], match[1].trim());
  },
  renderer(token: Tokens.Generic): string {
    const mathToken = token as MathToken;
    const encoded = encodeMathForDataAttribute(mathToken.text);
    return `<span class="math-inline-placeholder" data-math="${encoded}"></span>`;
  },
};

function ensureMarkedConfigured(): void {
  if (markedConfigured) {
    return;
  }

  marked.use({
    breaks: true,
    gfm: true,
    extensions: [displayMathExtension, inlineMathExtension],
  });

  markedConfigured = true;
}

/**
 * Renders markdown text to HTML element
 * @param markdown - The markdown text to render
 * @param options - Rendering options including math mode
 * @returns HTMLElement containing the rendered content
 */
export function renderMarkdown(markdown: string, _options: MarkdownOptions = { mathMode: { type: 'html' } }): HTMLElement {
  ensureMarkedConfigured();

  // Convert markdown to HTML
  const html = marked(markdown) as string;
  
  // Create container element
  const container = document.createElement('div');
  container.innerHTML = html;
  
  return container;
}

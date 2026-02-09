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

interface SourceLineRange {
  startLine: number;
  endLine: number;
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

  const container = document.createElement('div');
  const tokens = marked.lexer(markdown) as Tokens.Generic[];

  let searchCursor = 0;
  let lineCursor = 1;

  tokens.forEach((token) => {
    const range = resolveSourceLineRange(markdown, token.raw ?? '', searchCursor, lineCursor);
    searchCursor = range.nextSearchCursor;
    lineCursor = range.nextLineCursor;

    if (token.type === 'space') {
      return;
    }

    const html = marked.parser([token]) as string;
    appendTokenHtml(container, html, {
      startLine: range.startLine,
      endLine: range.endLine,
    });
  });

  return container;
}

function resolveSourceLineRange(
  markdown: string,
  raw: string,
  searchCursor: number,
  lineCursor: number,
): {
  startLine: number;
  endLine: number;
  nextSearchCursor: number;
  nextLineCursor: number;
} {
  if (!raw) {
    return {
      startLine: lineCursor,
      endLine: lineCursor,
      nextSearchCursor: searchCursor,
      nextLineCursor: lineCursor,
    };
  }

  let matchedIndex = markdown.indexOf(raw, searchCursor);
  if (matchedIndex < 0) {
    matchedIndex = searchCursor;
  }

  const skippedText = markdown.slice(searchCursor, matchedIndex);
  const startLine = lineCursor + countLineBreaks(skippedText);
  const endLine = startLine + countLineBreaks(raw);

  return {
    startLine,
    endLine: Math.max(startLine, endLine),
    nextSearchCursor: Math.max(searchCursor, matchedIndex + raw.length),
    nextLineCursor: Math.max(startLine, endLine),
  };
}

function appendTokenHtml(container: HTMLElement, html: string, range: SourceLineRange): void {
  if (!html.trim()) {
    return;
  }

  const chunkContainer = document.createElement('div');
  chunkContainer.innerHTML = html;

  const nodes = Array.from(chunkContainer.childNodes);
  if (nodes.length === 0) {
    return;
  }

  nodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      annotateSourceLineRange(element, range);
      container.appendChild(element);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text.trim()) {
        container.appendChild(node);
        return;
      }

      const wrapper = document.createElement('span');
      wrapper.textContent = text;
      annotateSourceLineRange(wrapper, range);
      container.appendChild(wrapper);
      return;
    }

    container.appendChild(node);
  });
}

function annotateSourceLineRange(element: HTMLElement, range: SourceLineRange): void {
  element.dataset.sourceLineStart = String(range.startLine);
  element.dataset.sourceLineEnd = String(range.endLine);
  element.classList.add('source-line-anchor');
}

function countLineBreaks(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      count += 1;
    }
  }
  return count;
}

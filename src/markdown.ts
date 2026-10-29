import { marked, RendererExtension, TokenizerExtension, Tokens } from 'marked';
import DOMPurify from 'dompurify';
import { DEFAULT_SETTINGS, type DocumentSettings, validLabel } from './document.js';

export interface MathMode {
  type: 'html' | 'svg';
}

export interface MarkdownOptions {
  mathMode: MathMode;
  settings?: DocumentSettings;
}

interface MathToken extends Tokens.Generic {
  type: 'mathDisplay' | 'mathInline';
  raw: string;
  text: string;
  label?: string;
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
    const match = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\{#(eq:[\w:-]+)\}[ \t]*)?(?:\n|$)/.exec(src);
    if (!match) {
      return undefined;
    }
    return { ...createMathToken('mathDisplay', match[0], match[1].trim()), label: match[2] };
  },
  renderer(token: Tokens.Generic): string {
    const mathToken = token as MathToken;
    const encoded = encodeMathForDataAttribute(mathToken.text);
    return `<div class="math-display-placeholder" data-math="${encoded}"${mathToken.label ? ` data-label="${mathToken.label}"` : ''}></div>`;
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
    extensions: [displayMathExtension, inlineMathExtension, {
      name: 'documentReference', level: 'inline',
      start: (src: string) => src.indexOf('[@'),
      tokenizer(src: string): Tokens.Generic | undefined {
        const match = /^\[@((?:eq|fig|tab):[\w:-]+)\]/.exec(src);
        return match ? { type: 'documentReference', raw: match[0], label: match[1] } : undefined;
      },
      renderer(token: Tokens.Generic): string {
        return `<a class="document-reference" data-reference="${token.label}"></a>`;
      },
    }, {
      name: 'pageBreak', level: 'block',
      start: (src: string) => src.indexOf('<!-- pagebreak -->'),
      tokenizer(src: string): Tokens.Generic | undefined {
        const match = /^<!-- pagebreak -->[ \t]*(?:\n|$)/.exec(src);
        return match ? { type: 'pageBreak', raw: match[0] } : undefined;
      },
      renderer: () => '<div class="manual-page-break" data-page-break="true"></div>',
    }],
  });

  markedConfigured = true;
}

/**
 * Renders markdown text to HTML element
 * @param markdown - The markdown text to render
 * @param options - Rendering options including math mode
 * @returns HTMLElement containing the rendered content
 */
export function renderMarkdown(markdown: string, options: MarkdownOptions = { mathMode: { type: 'html' } }): HTMLElement {
  ensureMarkedConfigured();
  const container = document.createElement('div');
  const tokens = marked.lexer(markdown);
  let offset = 0;
  for (const token of tokens) {
    const fragment = document.createElement('div');
    const single = Object.assign([token], { links: tokens.links });
    fragment.innerHTML = DOMPurify.sanitize(marked.parser(single), { ADD_ATTR: ['data-label', 'data-math', 'data-reference', 'data-page-break'] });
    fragment.querySelectorAll<HTMLElement>('*').forEach(element => {
      element.dataset.sourceStart = String(offset);
      element.dataset.sourceEnd = String(offset + token.raw.length);
    });
    const mathTokens = /```[\s\S]*?```|`[^`\n]*`|(?<![\\$])\$\$([\s\S]+?)\$\$(?:[ \t]*\{#eq:[\w:-]+\})?|(?<![\\$])\$([^$\n]+?)\$(?!\$)/g;
    const matches = Array.from(token.raw.matchAll(mathTokens)).filter(m => m[1] !== undefined || m[2] !== undefined);
    fragment.querySelectorAll<HTMLElement>('.math-display-placeholder, .math-inline-placeholder').forEach((element, i) => {
      if (matches[i]) {
        element.dataset.sourceStart = String(offset + matches[i].index!);
        element.dataset.sourceEnd = String(offset + matches[i].index! + matches[i][0].length);
      }
    });
    container.append(...Array.from(fragment.childNodes));
    offset += token.raw.length;
  }
  decorateDocument(container, options.settings ?? DEFAULT_SETTINGS);
  return container;
}

export function decorateDocument(container: HTMLElement, settings: DocumentSettings): void {
  const targets = new Map<string, { id: string; text: string }>();
  const register = (element: HTMLElement, label: string | undefined, text: string, fallback: string) => {
    element.id = label && validLabel(label) ? label : fallback;
    if (!label || !validLabel(label)) return;
    if (targets.has(label)) element.dataset.duplicateLabel = label;
    else targets.set(label, { id: element.id, text });
  };
  const headings = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
  headings.forEach((heading, i) => { heading.id = `section-${i + 1}`; });
  let equationNumber = 0;
  container.querySelectorAll<HTMLElement>('.math-display-placeholder').forEach((math, i) => {
    const numbered = settings.numberEquations || !!math.dataset.label;
    if (numbered) equationNumber++;
    const equation = document.createElement('figure');
    equation.className = 'equation-block';
    equation.dataset.sourceStart = math.dataset.sourceStart;
    equation.dataset.sourceEnd = math.dataset.sourceEnd;
    register(equation, math.dataset.label, `Equation (${equationNumber})`, `equation-${i + 1}`);
    math.replaceWith(equation);
    equation.append(math);
    if (numbered) {
      const number = document.createElement('figcaption');
      number.className = 'equation-number';
      number.textContent = `(${equationNumber})`;
      equation.append(number);
    }
  });
  container.querySelectorAll<HTMLElement>('table').forEach(table => {
    const caption = table.nextElementSibling;
    const match = caption?.tagName === 'P' ? /^: (.*?)\s*\{#(tab:[\w:-]+)\}$/.exec(caption.textContent ?? '') : null;
    if (match) {
      const figure = document.createElement('figure');
      figure.className = 'table-figure';
      figure.dataset.label = match[2];
      figure.dataset.sourceStart = table.dataset.sourceStart;
      figure.dataset.sourceEnd = caption!.getAttribute('data-source-end') ?? table.dataset.sourceEnd;
      table.replaceWith(figure);
      figure.append(table);
      const text = document.createElement('figcaption');
      text.textContent = match[1];
      figure.append(text);
      caption!.remove();
    }
  });
  let figureCount = 0;
  let tableCount = 0;
  container.querySelectorAll<HTMLElement>('figure:not(.equation-block)').forEach(figure => {
    const isTable = !!figure.querySelector('table');
    const number = isTable ? ++tableCount : ++figureCount;
    const kind = isTable ? 'Table' : 'Figure';
    register(figure, figure.dataset.label, `${kind} ${number}`, `${isTable ? 'table' : 'figure'}-${number}`);
    let caption = figure.querySelector('figcaption');
    if (!caption && figure.dataset.label) { caption = document.createElement('figcaption'); figure.append(caption); }
    if (caption) caption.textContent = `${kind} ${number}.` + (caption.textContent ? ` ${caption.textContent}` : '');
  });
  container.querySelectorAll<HTMLAnchorElement>('[data-reference]').forEach(reference => {
    const label = reference.dataset.reference!;
    const target = targets.get(label);
    reference.textContent = target?.text ?? `Missing reference: ${label}`;
    if (target) reference.setAttribute('href', `#${target.id}`);
    else reference.classList.add('unresolved-reference');
  });
  if (settings.toc && headings.length) {
    const toc = document.createElement('nav');
    toc.className = 'document-toc';
    toc.setAttribute('aria-label', 'Table of contents');
    const title = document.createElement('h2');
    title.textContent = 'Contents';
    toc.append(title);
    headings.forEach(heading => {
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.style.paddingLeft = `${(Number(heading.tagName[1]) - 1) * 12}px`;
      toc.append(link);
    });
    const pagebreak = document.createElement('div');
    pagebreak.dataset.pageBreak = 'true';
    container.prepend(toc, pagebreak);
  }
  if (settings.titlePage) {
    const titlePage = document.createElement('section');
    titlePage.className = 'document-title-page';
    for (const [tag, text] of [['h1', settings.title || headings[0]?.textContent || 'Untitled'], ['p', settings.subtitle], ['p', settings.author], ['p', settings.date]]) {
      if (text) { const element = document.createElement(tag); element.textContent = text; titlePage.append(element); }
    }
    const pagebreak = document.createElement('div');
    pagebreak.dataset.pageBreak = 'true';
    container.prepend(titlePage, pagebreak);
  }
}

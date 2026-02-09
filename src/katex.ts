// Import KaTeX at runtime to avoid bundling issues
declare const katex: any;

export type MathRenderMode = 'html' | 'svg';

/**
 * Decodes HTML entities back to their original characters
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
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
 * Renders math expressions in the given HTML element using KaTeX
 * @param root - Root element to search for math expressions
 * @param mode - Rendering mode: 'html' (default) or 'svg'
 */
export function renderMath(root: HTMLElement, mode: MathRenderMode = 'html'): void {
  // Load KaTeX from CDN if not already loaded
  if (typeof katex === 'undefined') {
    console.warn('KaTeX library not loaded');
    return;
  }
  
  // Configure KaTeX options
  const options = {
    throwOnError: false,
    displayMode: false,
    output: mode,
    strict: false,
    trust: false,
  };

  // First pass: render markdown-stage math placeholders.
  const placeholders = root.querySelectorAll<HTMLElement>('.math-display-placeholder, .math-inline-placeholder');
  placeholders.forEach((placeholder) => {
    const math = decodeMathPayload(placeholder.dataset.math).trim();
    if (!math) {
      return;
    }

    const isDisplay = placeholder.classList.contains('math-display-placeholder');

    try {
      const rendered = katex.renderToString(math, {
        ...options,
        displayMode: isDisplay,
      });

      const wrapper = document.createElement(isDisplay ? 'div' : 'span');
      if (isDisplay) {
        wrapper.className = 'katex-display';
      }

      if (placeholder.classList.contains('source-line-anchor')) {
        wrapper.classList.add('source-line-anchor');
      }
      if (placeholder.dataset.sourceLineStart) {
        wrapper.dataset.sourceLineStart = placeholder.dataset.sourceLineStart;
      }
      if (placeholder.dataset.sourceLineEnd) {
        wrapper.dataset.sourceLineEnd = placeholder.dataset.sourceLineEnd;
      }

      wrapper.innerHTML = rendered;
      placeholder.replaceWith(wrapper);
    } catch (error) {
      console.warn('Failed to render placeholder math:', math, error);
    }
  });
  
  // Find and render display math expressions FIRST ($$...$$)
  // This must happen before inline math to avoid $...$ matching inside $$...$$
  const displayMathRegex = /\$\$([\s\S]+?)\$\$/g;
  let allTextContent = root.innerHTML;
  
  if (displayMathRegex.test(allTextContent)) {
    displayMathRegex.lastIndex = 0; // Reset regex
    const replacementHTML = allTextContent.replace(displayMathRegex, (match, math) => {
      try {
        // Strip <br> tags and decode HTML entities
        let cleanMath = math.replace(/<br\s*\/?>/gi, '\n');
        cleanMath = decodeHtmlEntities(cleanMath).trim();
        return `<div class="katex-display">${katex.renderToString(cleanMath, { ...options, displayMode: true })}</div>`;
      } catch (error) {
        console.warn('Failed to render display math:', math, error);
        return match;
      }
    });
    
    if (replacementHTML !== allTextContent) {
      root.innerHTML = replacementHTML;
    }
  }

  // Find and render inline math expressions ($...$)
  const inlineMathRegex = /\$([^$\n]+?)\$/g;
  const textNodes = getTextNodes(root);
  
  textNodes.forEach(node => {
    const text = node.textContent || '';
    if (inlineMathRegex.test(text)) {
      inlineMathRegex.lastIndex = 0; // Reset regex
      const parent = node.parentNode;
      if (!parent) return;
      
      const replacementHTML = text.replace(inlineMathRegex, (match, math) => {
        try {
          // Strip any HTML tags and decode entities
          let cleanMath = math.replace(/<[^>]+>/g, '');
          cleanMath = decodeHtmlEntities(cleanMath).trim();
          return katex.renderToString(cleanMath, { ...options, displayMode: false });
        } catch (error) {
          console.warn('Failed to render inline math:', math, error);
          return match;
        }
      });
      
      if (replacementHTML !== text) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = replacementHTML;
        parent.replaceChild(wrapper, node);
      }
    }
  });
}

/**
 * Gets all text nodes within an element
 */
function getTextNodes(element: HTMLElement): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip text nodes that are already inside katex elements
        const parent = node.parentElement;
        if (parent && (parent.classList.contains('katex') || parent.classList.contains('katex-display'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  
  return textNodes;
}

/**
 * Paginates rendered content into A4-sized pages.
 *
 * Strategy:
 * - Keep atomic blocks together (tables, display math, code blocks, images).
 * - Keep headings with the following block when possible.
 * - Split splittable blocks (paragraphs/lists/containers) when needed.
 */

interface TextBreakpoint {
  node: Text;
  offset: number;
}

interface SplitResult {
  head: HTMLElement;
  tail: HTMLElement;
}

const DEFAULT_PAGE_WIDTH_MM = 210;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_MARGIN_MM = 20;
const FIT_EPSILON_PX = 0.5;
const MIN_AVAILABLE_HEIGHT_PX = 24;

const ATOMIC_TAGS = new Set([
  'TABLE',
  'PRE',
  'IMG',
  'FIGURE',
  'HR',
  'SVG',
]);

const SPLITTABLE_TEXT_TAGS = new Set([
  'P',
  'LI',
]);

/**
 * Paginates content into A4-sized page elements.
 * @param content - The HTML content to paginate
 * @param pageHeightPx - Maximum content height per page in pixels
 * @returns Array of HTML elements representing page contents
 */
export function paginate(content: HTMLElement, pageHeightPx: number): HTMLElement[] {
  const pages: HTMLElement[] = [];
  const contentClone = content.cloneNode(true) as HTMLElement;
  const queue = getTopLevelElements(contentClone).map((element) => element.cloneNode(true) as HTMLElement);

  if (queue.length === 0) {
    return [createPageContent()];
  }

  const measureContainer = createMeasureContainer();
  document.body.appendChild(measureContainer);

  try {
    let currentBlocks: HTMLElement[] = [];

    while (queue.length > 0) {
      const block = queue.shift()!;

      if (block.dataset.pageBreak === 'true') {
        if (currentBlocks.length > 0) pages.push(createPageContent(currentBlocks));
        currentBlocks = [];
        continue;
      }

      if (shouldKeepWithNext(block) && queue.length > 0 && queue[0].dataset.pageBreak !== 'true') {
        const nextBlock = queue[0];
        if (fitsOnPage([...currentBlocks, block, nextBlock], pageHeightPx, measureContainer)) {
          currentBlocks.push(block, queue.shift()!);
          continue;
        }

        if (currentBlocks.length > 0) {
          pages.push(createPageContent(currentBlocks));
          currentBlocks = [];
          queue.unshift(block);
          continue;
        }
      }

      if (fitsOnPage([...currentBlocks, block], pageHeightPx, measureContainer)) {
        currentBlocks.push(block);
        continue;
      }

      const split = splitBlockToFit(block, currentBlocks, pageHeightPx, measureContainer);
      if (split) {
        currentBlocks.push(split.head);
        pages.push(createPageContent(currentBlocks));
        currentBlocks = [];
        queue.unshift(split.tail);
        continue;
      }

      if (currentBlocks.length === 0) {
        // Unsplittable oversized block: keep it intact on its own page.
        currentBlocks.push(block);
        pages.push(createPageContent(currentBlocks));
        currentBlocks = [];
        continue;
      }

      // Start a new page and retry this block there.
      pages.push(createPageContent(currentBlocks));
      currentBlocks = [];
      queue.unshift(block);
    }

    if (currentBlocks.length > 0 || pages.length === 0) {
      pages.push(createPageContent(currentBlocks));
    }
  } finally {
    document.body.removeChild(measureContainer);
  }

  return pages;
}

/**
 * Determines whether an element should never be split across pages.
 */
export function isAtomicElement(element: HTMLElement): boolean {
  if (ATOMIC_TAGS.has(element.tagName.toUpperCase())) {
    return true;
  }

  if (element.classList.contains('katex-display') || element.classList.contains('math-display-placeholder')) {
    return true;
  }

  return false;
}

function shouldKeepWithNext(element: HTMLElement): boolean {
  return /^H[1-6]$/.test(element.tagName);
}

function isSplittableElement(element: HTMLElement): boolean {
  if (isAtomicElement(element)) {
    return false;
  }

  const tag = element.tagName.toUpperCase();
  if (SPLITTABLE_TEXT_TAGS.has(tag)) {
    return true;
  }

  if (tag === 'UL' || tag === 'OL') {
    return element.children.length > 1;
  }

  if (tag === 'BLOCKQUOTE' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
    return element.children.length > 1 || collectTextBreakpoints(element).length > 1;
  }

  return false;
}

function splitBlockToFit(
  block: HTMLElement,
  currentBlocks: HTMLElement[],
  pageHeightPx: number,
  measureContainer: HTMLElement,
): SplitResult | null {
  const currentHeight = measureBlocksHeight(currentBlocks, measureContainer);
  const availableHeight = pageHeightPx - currentHeight;

  if (availableHeight < MIN_AVAILABLE_HEIGHT_PX || !isSplittableElement(block)) {
    return null;
  }

  if (block.tagName === 'UL' || block.tagName === 'OL') {
    const splitList = splitListByItems(block, currentBlocks, pageHeightPx, measureContainer);
    if (splitList) {
      return splitList;
    }
  }

  const splitByChildren = splitContainerByChildren(block, currentBlocks, pageHeightPx, measureContainer);
  if (splitByChildren) {
    return splitByChildren;
  }

  return splitTextElementByWords(block, currentBlocks, pageHeightPx, measureContainer);
}

function splitListByItems(
  list: HTMLElement,
  currentBlocks: HTMLElement[],
  pageHeightPx: number,
  measureContainer: HTMLElement,
): SplitResult | null {
  const items = Array.from(list.children) as HTMLElement[];
  if (items.length < 2) {
    return null;
  }

  let low = 1;
  let high = items.length - 1;
  let bestCount = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const head = createListFragment(list, items.slice(0, mid), 0);
    if (fitsOnPage([...currentBlocks, head], pageHeightPx, measureContainer)) {
      bestCount = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestCount <= 0 || bestCount >= items.length) {
    return null;
  }

  const head = createListFragment(list, items.slice(0, bestCount), 0);
  const tail = createListFragment(list, items.slice(bestCount), bestCount);

  if (!hasRenderableContent(head) || !hasRenderableContent(tail)) {
    return null;
  }

  return mapSplitSource(list, head, tail);
}

function createListFragment(sourceList: HTMLElement, items: HTMLElement[], offset: number): HTMLElement {
  const list = sourceList.cloneNode(false) as HTMLElement;
  list.innerHTML = '';

  items.forEach((item) => {
    list.appendChild(item.cloneNode(true));
  });

  if (list.tagName === 'OL') {
    const start = parseInt(sourceList.getAttribute('start') || '1', 10);
    const nextStart = Number.isFinite(start) ? start + offset : 1 + offset;
    list.setAttribute('start', String(nextStart));
  }

  return list;
}

function splitContainerByChildren(
  container: HTMLElement,
  currentBlocks: HTMLElement[],
  pageHeightPx: number,
  measureContainer: HTMLElement,
): SplitResult | null {
  const children = Array.from(container.children) as HTMLElement[];
  if (children.length < 2) {
    return null;
  }

  let low = 1;
  let high = children.length - 1;
  let bestCount = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const head = createContainerFragment(container, children.slice(0, mid));
    if (fitsOnPage([...currentBlocks, head], pageHeightPx, measureContainer)) {
      bestCount = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestCount <= 0 || bestCount >= children.length) {
    return null;
  }

  const head = createContainerFragment(container, children.slice(0, bestCount));
  const tail = createContainerFragment(container, children.slice(bestCount));

  if (!hasRenderableContent(head) || !hasRenderableContent(tail)) {
    return null;
  }

  return mapSplitSource(container, head, tail);
}

function createContainerFragment(sourceContainer: HTMLElement, children: HTMLElement[]): HTMLElement {
  const fragmentContainer = sourceContainer.cloneNode(false) as HTMLElement;
  fragmentContainer.innerHTML = '';
  children.forEach((child) => {
    fragmentContainer.appendChild(child.cloneNode(true));
  });
  return fragmentContainer;
}

function splitTextElementByWords(
  element: HTMLElement,
  currentBlocks: HTMLElement[],
  pageHeightPx: number,
  measureContainer: HTMLElement,
): SplitResult | null {
  const breakpoints = collectTextBreakpoints(element);
  if (breakpoints.length < 2) {
    return null;
  }

  let low = 0;
  let high = breakpoints.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidateSplit = buildTextSplit(element, breakpoints[mid]);

    if (!candidateSplit) {
      high = mid - 1;
      continue;
    }

    if (fitsOnPage([...currentBlocks, candidateSplit.head], pageHeightPx, measureContainer)) {
      bestIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  const split = buildTextSplit(element, breakpoints[bestIndex]);
  if (!split) {
    return null;
  }

  if (!hasRenderableContent(split.head) || !hasRenderableContent(split.tail)) {
    return null;
  }

  if (normalizeText(split.head.textContent) === normalizeText(element.textContent)) {
    return null;
  }

  return split;
}

function buildTextSplit(element: HTMLElement, breakpoint: TextBreakpoint): SplitResult | null {
  const headRange = document.createRange();
  headRange.setStart(element, 0);
  headRange.setEnd(breakpoint.node, breakpoint.offset);

  const tailRange = document.createRange();
  tailRange.setStart(breakpoint.node, breakpoint.offset);
  tailRange.setEnd(element, element.childNodes.length);

  const head = element.cloneNode(false) as HTMLElement;
  head.innerHTML = '';
  head.appendChild(headRange.cloneContents());

  const tail = element.cloneNode(false) as HTMLElement;
  tail.innerHTML = '';
  tail.appendChild(tailRange.cloneContents());

  if (!hasRenderableContent(head) || !hasRenderableContent(tail)) {
    return null;
  }

  return mapSplitSource(element, head, tail);
}

/** Retain approximate source ranges for each fragment of a split Markdown block. */
function mapSplitSource(original: HTMLElement, head: HTMLElement, tail: HTMLElement): SplitResult {
  const start = Number(original.dataset.sourceStart), end = Number(original.dataset.sourceEnd);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const total = (original.textContent || '').length;
    const ratio = total ? (head.textContent || '').length / total : .5;
    const boundary = Math.min(end - 1, Math.max(start + 1, Math.round(start + (end - start) * ratio)));
    for (const [fragment, from, to] of [[head, start, boundary], [tail, boundary, end]] as const) {
      for (const child of [fragment, ...Array.from(fragment.querySelectorAll<HTMLElement>('[data-source-start]'))]) {
        if (Number(child.dataset.sourceStart) === start && Number(child.dataset.sourceEnd) === end) {
          child.dataset.sourceStart = String(from); child.dataset.sourceEnd = String(to);
        }
      }
    }
  }
  return { head, tail };
}

function collectTextBreakpoints(element: HTMLElement): TextBreakpoint[] {
  const breakpoints: TextBreakpoint[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const text = node.textContent ?? '';

    if (node.parentElement?.closest('.rendered-equation, .katex, math, svg')) {
      current = walker.nextNode();
      continue;
    }

    if (text.trim().length > 0) {
      const whitespaceRegex = /\s+/g;
      let match: RegExpExecArray | null = whitespaceRegex.exec(text);
      while (match) {
        const offset = match.index + match[0].length;
        if (offset > 0 && offset < text.length) {
          breakpoints.push({ node, offset });
        }
        match = whitespaceRegex.exec(text);
      }

      breakpoints.push({ node, offset: text.length });
    }

    current = walker.nextNode();
  }

  return dedupeBreakpoints(breakpoints);
}

function dedupeBreakpoints(points: TextBreakpoint[]): TextBreakpoint[] {
  const deduped: TextBreakpoint[] = [];

  points.forEach((point) => {
    const last = deduped[deduped.length - 1];
    if (!last || last.node !== point.node || last.offset !== point.offset) {
      deduped.push(point);
    }
  });

  return deduped;
}

function hasRenderableContent(element: HTMLElement): boolean {
  const text = normalizeText(element.textContent);
  if (text.length > 0) {
    return true;
  }

  return Boolean(element.querySelector('img, table, pre, hr, svg, .katex-display'));
}

function normalizeText(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function fitsOnPage(blocks: HTMLElement[], pageHeightPx: number, measureContainer: HTMLElement): boolean {
  return measureBlocksHeight(blocks, measureContainer) <= pageHeightPx + FIT_EPSILON_PX;
}

function measureBlocksHeight(blocks: HTMLElement[], measureContainer: HTMLElement): number {
  measureContainer.innerHTML = '';
  blocks.forEach((block) => {
    measureContainer.appendChild(block.cloneNode(true));
  });
  return measureContainer.scrollHeight;
}

function getTopLevelElements(container: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];

  Array.from(container.children).forEach((child) => {
    const element = child as HTMLElement;
    if (isNeutralWrapper(element)) {
      elements.push(...getTopLevelElements(element));
      return;
    }
    elements.push(element);
  });

  return elements;
}

function isNeutralWrapper(element: HTMLElement): boolean {
  return element.tagName === 'DIV' && element.attributes.length === 0 && element.children.length > 0;
}

function createPageContent(blocks: HTMLElement[] = []): HTMLElement {
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  blocks.forEach((block) => {
    pageContent.appendChild(block);
  });
  return pageContent;
}

function createMeasureContainer(): HTMLElement {
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  const pageWidthMm = getCssNumericValue(computed.getPropertyValue('--page-width-mm'), DEFAULT_PAGE_WIDTH_MM);
  const fontSize = getCssNumericValue(computed.getPropertyValue('--page-font-size'), DEFAULT_FONT_SIZE_PX);
  const marginMm = getCssNumericValue(computed.getPropertyValue('--page-margin'), DEFAULT_MARGIN_MM);
  const contentWidthMm = Math.max(pageWidthMm - (marginMm * 2), 60);

  const container = document.createElement('div');
  container.className = 'page-content';
  container.style.cssText = `
    position: absolute;
    left: -100000px;
    top: 0;
    visibility: hidden;
    width: ${contentWidthMm}mm;
    height: auto;
    overflow: visible;
    padding: 0;
    margin: 0;
    font-family: var(--document-font, Georgia, "Times New Roman", serif);
    font-size: ${fontSize}px;
    line-height: var(--document-leading, 1.6);
    white-space: normal;
    box-sizing: border-box;
  `;

  return container;
}

function getCssNumericValue(value: string, fallback: number): number {
  const parsed = parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

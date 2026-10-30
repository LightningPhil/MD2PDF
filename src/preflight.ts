import katex from 'katex';

export interface ExportIssue { message: string; source: number; severity: 'warning' | 'error'; documentId?: string; filename?: string }
export async function waitForImages(root: HTMLElement, timeout = 2500): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); image.removeEventListener('load', finish); image.removeEventListener('error', finish); resolve(); };
    const timer = setTimeout(finish, timeout);
    image.addEventListener('load', finish, { once: true }); image.addEventListener('error', finish, { once: true });
  })));
}
export function inspectOutput(root: HTMLElement, source: string): ExportIssue[] {
  const issues: ExportIssue[] = [];
  const add = (element: Element, message: string, severity: ExportIssue['severity'] = 'warning') => {
    const mapped = element.closest<HTMLElement>('[data-source-start]');
    const position = Number(mapped?.dataset.sourceStart || 0);
    if (!issues.some(issue => issue.source === position && issue.message === message)) issues.push({ message, source: position, severity });
  };
  root.querySelectorAll<HTMLElement>('[data-math]').forEach(element => {
    try {
      katex.renderToString(decodeURIComponent(element.dataset.math || ''), { throwOnError: true, strict: false, trust: false });
    } catch (error) {
      add(element, `Invalid equation: ${error instanceof Error ? error.message.replace(/^KaTeX parse error: /, '') : 'Check the expression.'}`, 'error');
    }
  });
  root.querySelectorAll('.katex-error').forEach(element => {
    if (!element.closest('[data-math]')) add(element, `Invalid equation: ${element.getAttribute('title') || element.textContent}`, 'error');
  });
  root.querySelectorAll('.unresolved-reference').forEach(element => add(element, element.textContent || 'Missing cross-reference', 'error'));
  root.querySelectorAll<HTMLElement>('[data-duplicate-label]').forEach(element => add(element, `Duplicate reference label: ${element.dataset.duplicateLabel}`, 'error'));
  root.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    if (!image.complete || image.naturalWidth === 0) add(image, 'Image could not be loaded. Replace it or check its URL.', 'error');
    if (!image.alt.trim()) add(image, 'Image is missing alternative text.');
  });
  root.querySelectorAll<HTMLElement>('.document-header, .document-footer').forEach(element => {
    if (element.scrollWidth > element.clientWidth + 1) add(element, 'Running header or footer text is too long and will be clipped. Shorten it.');
  });
  root.querySelectorAll<HTMLElement>('.page-content').forEach(content => {
    const page = content.closest<HTMLElement>('.page')!;
    const rect = page.getBoundingClientRect();
    if (!rect.width || !page.clientWidth) return;
    const scale = rect.width / page.clientWidth;
    const margin = parseFloat(getComputedStyle(content).paddingBottom) * scale;
    for (const block of Array.from(content.children) as HTMLElement[]) {
      const blockRect = block.getBoundingClientRect();
      if (blockRect.bottom > rect.bottom - margin + 2) add(block, 'Content extends below the printable area. Split this block or reduce its size.', 'error');
      if (block.scrollWidth > block.clientWidth + 2 || blockRect.right > rect.right - margin + 2) add(block, 'Content is wider than the printable area. Reduce its width or use landscape-sized paper.', 'error');
      block.querySelectorAll<HTMLElement>('table, pre, .rendered-equation, img').forEach(element => {
        const box = element.getBoundingClientRect();
        if (box.right > rect.right - margin + 2 || element.scrollWidth > element.clientWidth + 2) add(element, 'A table, equation, image, or code block is too wide for this page.', 'error');
      });
    }
    const last = content.lastElementChild;
    if (last && /^H[1-6]$/.test(last.tagName)) add(last, 'A heading is stranded at the bottom of a page. Add a page break before it.');
  });
  const withoutCode = source.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, match => ' '.repeat(match.length));
  const dollars = Array.from(withoutCode.matchAll(/(?<!\\)\$\$/g));
  if (dollars.length % 2) issues.push({ message: 'A display equation has an unmatched $$ delimiter.', source: dollars[dollars.length - 1].index!, severity: 'error' });
  return issues;
}

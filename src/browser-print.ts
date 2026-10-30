import { applyDocumentStyle, decodeDocument } from './document.js';
import { renderMarkdown } from './markdown.js';
import { PageManager } from './pages.js';
import { waitForImages } from './preflight.js';

const sizes = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6], tabloid: [279.4, 431.8], a3: [297, 420] };
/** Prepare vector/text pages for the browser's native Save as PDF destination. */
export async function prepareBrowserPrint(documents: { filename: string; content: string }[]): Promise<() => void> {
  if (!documents.length) throw new Error('Open a Markdown document first.');
  if (documents.some(doc => /\.tex$/i.test(doc.filename))) throw new Error('PDF export supports Markdown documents. Save any legacy .tex source separately and close it before exporting all files.');
  document.getElementById('browserPrintOutput')?.remove();
  document.getElementById('browserPrintStyle')?.remove();
  const output = document.createElement('div'); output.id = 'browserPrintOutput';
  output.style.cssText = 'position:absolute;left:-100000px;top:0;';
  document.body.append(output);
  const style = document.createElement('style'); style.id = 'browserPrintStyle'; document.head.append(style);
  const previousStyle = document.documentElement.style.cssText;
  const previousPreset = document.documentElement.dataset.documentPreset;
  const previousTitle = document.title;
  const cleanup = () => { document.body.classList.remove('browser-print-ready'); output.remove(); style.remove(); document.title = previousTitle; window.removeEventListener('afterprint', cleanup); };
  try {
    await document.fonts.ready;
    for (const [index, item] of documents.entries()) {
      const decoded = decodeDocument(item.content); const settings = decoded.settings;
      const content = renderMarkdown(decoded.content, { settings, mathMode: { type: 'html' } });
      await waitForImages(content, 10000);
      applyDocumentStyle(settings);
      const [width, height] = sizes[settings.pageSize];
      document.documentElement.style.setProperty('--page-width-mm', String(width));
      document.documentElement.style.setProperty('--page-height-mm', String(height));
      const section = document.createElement('section'); section.id = `browserPrintDocument${index}`;
      section.style.cssText = document.documentElement.style.cssText; output.append(section);
      const manager = new PageManager(section.id); manager.setSettings(settings); manager.updatePages(content);
      // Avoid duplicate destinations when multiple documents have identical headings/labels.
      const targets = new Map<string, string>();
      section.querySelectorAll<HTMLElement>('[id]').forEach(el => { const old = el.id; el.id = `print-${index}-${old}`; targets.set(old, el.id); });
      section.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(el => { const id = targets.get(el.getAttribute('href')!.slice(1)); if (id) el.setAttribute('href', '#' + id); });
      section.querySelectorAll<HTMLElement>('.page').forEach(page => { page.style.page = `document${index}`; });
      document.documentElement.style.cssText = previousStyle;
      style.textContent += `@page document${index} { size:${width}mm ${height}mm; margin:0; }\n`;
    }
    document.title = documents.length === 1 ? documents[0].filename.replace(/\.(md|markdown)$/i, '') : 'MD2PDF documents';
    document.body.classList.add('browser-print-ready');
    window.addEventListener('afterprint', cleanup);
    return cleanup;
  } catch (error) { cleanup(); throw error; }
  finally {
    document.documentElement.style.cssText = previousStyle;
    if (previousPreset === undefined) delete document.documentElement.dataset.documentPreset;
    else document.documentElement.dataset.documentPreset = previousPreset;
  }
}

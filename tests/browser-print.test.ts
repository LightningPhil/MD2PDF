// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { prepareBrowserPrint } from '../src/browser-print';
import { DEFAULT_SETTINGS, encodeDocument } from '../src/document';
import { inspectOutput } from '../src/preflight';

describe('print preparation without opening an app or print dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Workspace';
    document.documentElement.style.cssText = '--document-table-background: pink;';
    document.documentElement.dataset.documentPreset = 'custom';
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  });
  afterEach(() => { window.dispatchEvent(new Event('afterprint')); });
  it('isolates document styles, page sizes, numbering and link destinations', async () => {
    const source = '# Method\n\nText\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const cleanup = await prepareBrowserPrint([
      { filename: 'Technical.md', content: encodeDocument(source, { ...DEFAULT_SETTINGS, preset: 'technical', toc: true, pageSize: 'letter' }) },
      { filename: 'Notes.md', content: encodeDocument(source, { ...DEFAULT_SETTINGS, preset: 'notes', toc: true, pageSize: 'a4' }) },
    ]);
    const sections = document.querySelectorAll<HTMLElement>('#browserPrintOutput > section');
    expect(sections).toHaveLength(2);
    expect(sections[0].style.getPropertyValue('--document-table-background')).toBe('#eaf1f7');
    expect(sections[1].style.getPropertyValue('--document-table-background')).toBe('#edf3e9');
    expect(document.getElementById('browserPrintStyle')?.textContent).toContain('215.9mm 279.4mm');
    expect(sections[1].querySelector('.page-number')?.textContent).toBe('1');
    for (const section of sections) for (const link of section.querySelectorAll<HTMLAnchorElement>('.document-toc a')) {
      expect(section.querySelector(`[id="${link.hash.slice(1)}"]`)).not.toBeNull();
    }
    expect(new Set(Array.from(document.querySelectorAll('[id]'), el => el.id)).size).toBe(document.querySelectorAll('[id]').length);
    expect(document.documentElement.style.getPropertyValue('--document-table-background')).toBe('pink');
    expect(document.documentElement.dataset.documentPreset).toBe('custom');
    cleanup(); cleanup();
    expect(document.getElementById('browserPrintOutput')).toBeNull();
    expect(document.title).toBe('Workspace');
  });
  it('rejects invalid math and missing references and restores workspace state', async () => {
    for (const content of ['See [@eq:missing].', '$$\\invalidcommand$$']) {
      await expect(prepareBrowserPrint([{ filename: 'Broken.md', content }])).rejects.toThrow('before exporting');
      expect(document.getElementById('browserPrintOutput')).toBeNull();
      expect(document.getElementById('browserPrintStyle')).toBeNull();
      expect(document.body.classList.contains('browser-print-ready')).toBe(false);
      expect(document.title).toBe('Workspace');
    }
  });
  it('rejects empty selections and legacy TeX without altering source', async () => {
    await expect(prepareBrowserPrint([])).rejects.toThrow('Open a Markdown');
    await expect(prepareBrowserPrint([{ filename: 'Legacy.tex', content: 'source' }])).rejects.toThrow('legacy .tex');
  });
  it('cleans the previous preparation when repeated and after print completion', async () => {
    await prepareBrowserPrint([{ filename: 'First.md', content: 'First' }]);
    await prepareBrowserPrint([{ filename: 'Second.md', content: 'Second' }]);
    expect(document.querySelectorAll('#browserPrintOutput')).toHaveLength(1);
    expect(document.getElementById('browserPrintOutput')?.textContent).not.toContain('First');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('Workspace');
    expect(document.getElementById('browserPrintOutput')).toBeNull();
  });
  it('classifies clipped running text and oversized blocks as blocking errors', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="page"><div class="page-content" style="padding-bottom:20px"><pre data-source-start="12">Code</pre></div><div class="document-footer">Long footer</div></div>';
    const page = root.querySelector<HTMLElement>('.page')!;
    Object.defineProperty(page, 'clientWidth', { value: 200 });
    page.getBoundingClientRect = () => ({ width: 200, right: 200, bottom: 300 } as DOMRect);
    root.querySelector('pre')!.getBoundingClientRect = () => ({ right: 240, bottom: 350 } as DOMRect);
    Object.defineProperty(root.querySelector('.document-footer'), 'scrollWidth', { value: 500 });
    const issues = inspectOutput(root, '');
    expect(issues.filter(issue => issue.severity === 'error')).toHaveLength(3);
    expect(issues.some(issue => issue.source === 12 && issue.message.includes('below'))).toBe(true);
  });
});

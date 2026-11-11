// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UIController } from '../src/ui';
import { MarkdownEditor } from '../src/editor';
import { MediaTools } from '../src/media-tools';
import { LayoutTools } from '../src/layout-tools';
import { DEFAULT_SETTINGS } from '../src/document';
import { requestFilename, confirmDocumentClose } from '../src/dialog';

// Static markup fixture only: script tags are removed and main.ts is never imported.
const markup = readFileSync('index.html', 'utf8').match(/<body[^>]*>([\s\S]*)<\/body>/)![1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
beforeEach(() => {
  document.body.innerHTML = markup;
  document.documentElement.style.cssText = '';
  localStorage.clear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); } });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const input = (id: string, value: string) => { const el = document.getElementById(id) as HTMLInputElement; el.value = value; el.dispatchEvent(new Event('input')); };

describe('workspace controls in isolation', () => {
  it('retains keyboard focus when renaming or removing a document rebuilds the list', () => {
    const ui = new UIController();
    ui.renderDocumentList([{ id: 'draft', filename: 'Draft.md', pageCount: 1, isActive: true }]);
    document.querySelector<HTMLButtonElement>('[aria-label="Rename Draft.md"]')!.focus();
    ui.renderDocumentList([{ id: 'draft', filename: 'Revision.md', pageCount: 1, isActive: true }]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Rename Revision.md');
    document.querySelector<HTMLButtonElement>('[aria-label="Close Revision.md"]')!.focus();
    ui.renderDocumentList([]);
    expect(document.activeElement?.id).toBe('markdownEditor');
  });
  it('validates rename, returns a name on submit and preserves cancel semantics', async () => {
    const renamed = requestFilename('draft.md');
    const field = document.querySelector<HTMLInputElement>('[name="filename"]')!;
    const form = field.closest('form')!;
    field.value = ' '; form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(form.textContent).toContain('Enter a filename'); expect(field.closest('dialog')!.open).toBe(true);
    field.value = 'Revision 2.md'; form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(await renamed).toBe('Revision 2.md');
    const cancelled = requestFilename('Revision 2.md');
    document.querySelector<HTMLButtonElement>('dialog [data-cancel]')!.click();
    expect(await cancelled).toBeNull();
  });
  it('defaults close confirmation to cancel and returns explicit confirmation only', async () => {
    const cancelled = confirmDocumentClose('<draft>.md');
    expect(document.querySelector('.close-document-name')!.textContent).toBe('<draft>.md');
    expect(document.activeElement?.textContent).toBe('Cancel');
    (document.activeElement as HTMLButtonElement).click(); expect(await cancelled).toBe(false);
    const confirmed = confirmDocumentClose('draft.md');
    document.querySelector('dialog form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(await confirmed).toBe(true); expect(document.querySelector('.close-document-name')).toBeNull();
  });
  it('normalizes export scope before requesting checks and restores focus when dismissed', () => {
    const ui = new UIController();
    const dialog = document.getElementById('exportModalBackdrop') as HTMLDialogElement;
    const all = document.getElementById('exportScopeAll') as HTMLInputElement;
    ui.openExportModal({ activeFilename: 'A.md', totalFiles: 2 }); all.checked = true; ui.closeExportModal();
    let checked: boolean | undefined;
    dialog.addEventListener('export-opening', () => { checked = all.checked; });
    ui.openExportModal({ activeFilename: 'A.md', totalFiles: 1 });
    expect(checked).toBe(false); expect(dialog.open).toBe(true);
    ui.closeExportModal();
    expect(dialog.hidden).toBe(true); expect(document.activeElement?.id).toBe('exportPdfBtn');
    expect(document.body.classList.contains('export-modal-open')).toBe(false);
  });
  it('blocks dismissal during preparation and disables export for an empty workspace', () => {
    const ui = new UIController(); ui.openExportModal({ activeFilename: '', totalFiles: 0 });
    expect((document.getElementById('exportStartBtn') as HTMLButtonElement).disabled).toBe(true);
    ui.openExportModal({ activeFilename: 'A.md', totalFiles: 1 }); ui.setExportBusy(true); ui.closeExportModal();
    expect((document.getElementById('exportModalBackdrop') as HTMLDialogElement).open).toBe(true);
    ui.setExportBusy(false); ui.closeExportModal();
  });
  it('accepts TXT with unknown MIME and reports skipped unsupported files', async () => {
    const ui = new UIController(), loaded = vi.fn(); ui.onFileUpload(loaded);
    const picker = document.getElementById('uploadFile') as HTMLInputElement;
    Object.defineProperty(picker, 'files', { value: [new File(['Report'], 'report.txt'), new File(['binary'], 'file.pdf', { type: 'application/pdf' })] });
    picker.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(loaded).toHaveBeenCalledWith([{ filename: 'report.txt', content: 'Report' }]));
    expect(document.body.textContent).toContain('Skipped 1 unsupported file');
  });
  it('labels the source editor and exposes sidebar state', () => {
    new UIController();
    const editor = document.getElementById('markdownEditor')!;
    expect(document.getElementById(editor.getAttribute('aria-labelledby')!)).not.toBeNull();
    const toggle = document.getElementById('sidebarToggleBtn')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true'); toggle.click(); expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
describe('image and preset editing in isolation', () => {
  it('retains the base style when saving and applying a personal preset', () => {
    const apply = vi.fn();
    const layout = new LayoutTools(() => ({ ...DEFAULT_SETTINGS }), apply); layout.open();
    const select = document.querySelector<HTMLSelectElement>('[name="preset"]')!;
    select.value = 'technical'; select.dispatchEvent(new Event('change'));
    document.querySelector<HTMLInputElement>('[name="presetName"]')!.value = 'Team report';
    document.getElementById('saveStylePreset')!.click();
    expect(select.value).toBe('saved:Team report');
    select.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ preset: 'technical', fontSize: 14 }));
  });
  it('edits the selected occurrence of identical Markdown images', () => {
    const editor = new MarkdownEditor('markdownEditor');
    const media = new MediaTools(editor);
    const image = '![same](https://example.com/a.png)';
    editor.setContent(`First ${image} then ${image} last.`); const start = editor.getContent().lastIndexOf(image); editor.setSelection(start, start);
    media.openImage(); input('imageAlt', 'Second');
    document.getElementById('imageAlt')!.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getContent()).toContain(`First ${image} then`);
    expect(editor.getContent()).toContain('alt="Second"');
    expect(editor.getContent().match(/!\[same\]/g)).toHaveLength(1);
  });
  it('requires meaningful alt text and rejects unsupported image sources', () => {
    const editor = new MarkdownEditor('markdownEditor'); const media = new MediaTools(editor); media.openImage();
    input('imageSource', 'javascript:alert(1)'); input('imageAlt', ' ');
    const form = document.getElementById('imageAlt')!.closest('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true })); expect(form.textContent).toContain('Alternative text');
    input('imageAlt', 'Diagram'); form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(form.textContent).toContain('http/https'); expect(editor.getContent()).toBe('');
  });
  it('ignores malformed preset storage and keeps cancelled changes out of the document', () => {
    localStorage.setItem('md2pdf.style-presets', 'null'); const apply = vi.fn();
    const layout = new LayoutTools(() => ({ ...DEFAULT_SETTINGS }), apply); layout.open();
    const select = document.querySelector<HTMLSelectElement>('[name="preset"]')!;
    select.value = 'technical'; select.dispatchEvent(new Event('change'));
    expect(document.querySelector<HTMLInputElement>('[name="fontSize"]')!.value).toBe('14');
    document.querySelector<HTMLButtonElement>('[data-cancel]')!.click(); expect(apply).not.toHaveBeenCalled();
  });
});

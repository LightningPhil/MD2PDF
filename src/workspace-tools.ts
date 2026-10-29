import { MarkdownEditor } from './editor.js';
import { LayoutTools } from './layout-tools.js';
import { MediaTools } from './media-tools.js';
import { DocumentNavigation } from './navigation.js';
import { makeDialog, showDialog, dialogError, downloadBlob } from './dialog.js';
import { createPackage, readPackage } from './package.js';
import { type DocumentSettings, validLabel } from './document.js';
import type { ExportIssue } from './preflight.js';
interface WorkspaceHooks {
  getSettings(): DocumentSettings;
  setSettings(settings: DocumentSettings): void;
  getFilename(): string;
  importFiles(files: { filename: string; content: string }[]): void;
  newDocument(): void;
  checkOutput(all: boolean): Promise<ExportIssue[]>;
  goToIssue(issue: ExportIssue): void;
}
export class WorkspaceTools {
  readonly navigation: DocumentNavigation;
  private hooks: WorkspaceHooks;
  private checksRevision = 0;
  constructor(private editor: MarkdownEditor, hooks: WorkspaceHooks) {
    this.hooks = hooks;
    const layout = new LayoutTools(hooks.getSettings, hooks.setSettings);
    const media = new MediaTools(editor);
    this.navigation = new DocumentNavigation(editor, () => document.querySelector<HTMLButtonElement>('.equation-button')!.click(), () => media.openImage(), () => media.openTable());
    const actions = document.createElement('div'); actions.className = 'writing-actions'; actions.setAttribute('aria-label', 'Document tools');
    const add = (label: string, action: () => void, id?: string) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      if (id) button.id = id;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', action); actions.append(button); return button;
    };
    add('New', hooks.newDocument, 'newDocument');
    add('Style & layout', () => layout.open(), 'documentLayout');
    add('Find / replace', () => this.navigation.openFind(), 'openFind');
    add('Image', () => media.openImage(), 'openImage');
    add('Reference', () => this.openReferences(), 'openReferences');
    add('Page break', () => {
      const { start, end } = editor.getSelection();
      const before = editor.getContent().slice(0, start);
      editor.replaceRange(start, end, (before && !before.endsWith('\n\n') ? '\n\n' : '') + '<!-- pagebreak -->\n\n'); editor.focus();
    }, 'insertPageBreak');
    add('Check output', () => { void this.showChecks(); }, 'checkOutput');
    const packageButton = add('Save package', () => {
      packageButton.disabled = true;
      void createPackage(editor.getContent(), hooks.getFilename(), hooks.getSettings()).then(blob => downloadBlob(blob, hooks.getFilename().replace(/\.(md|markdown)$/i, '') + '.md2pdf.zip')).catch(error => this.setStatus(`Package could not save: ${error.message}`, true)).finally(() => { packageButton.disabled = false; });
    }, 'savePackage');
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.zip'; input.hidden = true; actions.append(input);
    add('Open package', () => input.click(), 'openPackage');
    input.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      void readPackage(file).then(document => hooks.importFiles([document])).catch(error => this.setStatus(`Package could not open: ${error.message}`, true)); input.value = '';
    });
    const focus = add('Focus', () => {
      const enabled = document.body.classList.toggle('focus-mode'); focus.textContent = enabled ? 'Exit focus' : 'Focus'; focus.setAttribute('aria-pressed', String(enabled)); window.dispatchEvent(new Event('resize'));
    }, 'focusWriting');
    focus.setAttribute('aria-pressed', 'false');
    const sync = add('Scroll sync: on', () => { this.navigation.syncEnabled = !this.navigation.syncEnabled; this.updateSyncButton(); }, 'syncScroll');
    sync.setAttribute('aria-pressed', 'true');
    document.querySelector('.editor-help')!.after(actions);
    const status = document.createElement('span'); status.id = 'saveStatus'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = 'Restoring workspace…';
    document.querySelector('.editor-pane > h3')!.append(status);
    const outline = document.createElement('section'); outline.className = 'outline-panel'; outline.innerHTML = '<h3>Document outline</h3><nav id="documentOutline" aria-label="Document outline"></nav>';
    document.getElementById('documentSidebar')!.append(outline);
    const checks = document.createElement('details'); checks.id = 'exportChecks'; checks.open = true;
    checks.innerHTML = '<summary>Output checks</summary><div id="exportCheckResults" role="status"></div>';
    document.querySelector('.export-scope-group')!.after(checks);
    for (const id of ['exportScopeCurrent', 'exportScopeAll']) document.getElementById(id)!.addEventListener('change', () => { void this.refreshExportChecks(); });
  }
  refresh(): void { this.navigation.refresh(); }
  setStatus(message: string, error = false): void {
    const element = document.getElementById('saveStatus')!; element.textContent = message; element.classList.toggle('save-error', error);
  }
  updateSyncButton(): void {
    const button = document.getElementById('syncScroll')!; button.textContent = `Scroll sync: ${this.navigation.syncEnabled ? 'on' : 'off'}`; button.setAttribute('aria-pressed', String(this.navigation.syncEnabled));
  }
  async refreshExportChecks(): Promise<void> {
    const revision = ++this.checksRevision;
    const target = document.getElementById('exportCheckResults')!;
    target.textContent = 'Checking equations, images, references, and page layout…';
    try {
      const issues = await this.hooks.checkOutput((document.getElementById('exportScopeAll') as HTMLInputElement).checked);
      if (revision === this.checksRevision) this.showIssues(target, issues);
    } catch { if (revision === this.checksRevision) target.textContent = 'Could not complete checks. Try Check output again.'; }
  }
  private showIssues(target: HTMLElement, issues: ExportIssue[]): void {
    target.replaceChildren();
    if (!issues.length) { target.textContent = 'No equation, image, reference, or layout problems found.'; return; }
    const text = document.createElement('p'); text.textContent = `${issues.length} item${issues.length === 1 ? '' : 's'} to review. Select an item to fix it.`; target.append(text);
    for (const issue of issues) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `output-issue ${issue.severity}`;
      button.dataset.sourceStart = String(issue.source);
      button.textContent = `${issue.filename ? issue.filename + ': ' : ''}${issue.message}`;
      button.addEventListener('click', () => {
        const dialog = target.closest('dialog');
        if (dialog) {
          dialog.addEventListener('close', () => { this.hooks.goToIssue(issue); }, { once: true });
          dialog.close();
        } else {
          document.getElementById('exportDismissBtn')!.click();
          this.hooks.goToIssue(issue);
        }
      });
      target.append(button);
    }
  }
  private async showChecks(): Promise<void> {
    const { dialog, form } = makeDialog('Check document output', '<div id="documentCheckResults" role="status">Checking document…</div>', 'Done');
    form.addEventListener('submit', event => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    showDialog(dialog);
    try {
      const issues = await this.hooks.checkOutput(false);
      this.showIssues(dialog.querySelector('#documentCheckResults')!, issues);
    } catch { dialogError(dialog, 'Could not finish checking this document.'); }
  }
  private openReferences(): void {
    const { dialog, form } = makeDialog('Insert cross-reference', '<label>Numbered equation, figure, or table<select id="referenceTarget"></select></label><p class="tool-help">Add reference labels in the equation, image, or table editor. References update as items move.</p>', 'Insert reference');
    const select = dialog.querySelector<HTMLSelectElement>('select')!;
    const labels = new Set<string>();
    document.querySelectorAll<HTMLElement>('#previewContainer figure[id]').forEach(figure => {
      if (!validLabel(figure.id) || labels.has(figure.id)) return;
      labels.add(figure.id);
      const option = document.createElement('option'); option.value = figure.id; option.textContent = `${figure.id} - ${figure.querySelector('figcaption')?.textContent || 'Numbered item'}`; select.append(option);
    });
    const range = this.editor.getSelection();
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!select.value) { dialogError(dialog, 'Add a reference label to an equation, figure, or table first.'); return; }
      this.editor.replaceRange(range.start, range.end, `[@${select.value}]`); dialog.close(); this.editor.focus();
    });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    showDialog(dialog);
  }
}

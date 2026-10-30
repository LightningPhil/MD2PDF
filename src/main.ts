import { prepareBrowserPrint } from './browser-print.js';
import { MarkdownEditor } from './editor.js';
import { AuthoringTools } from './authoring.js';
import * as bundledKatex from 'katex';
import 'katex/dist/katex.min.css';
import { WorkspaceTools } from './workspace-tools.js';
import { WorkspaceStore, type WorkspaceState, type StoredDocument } from './storage.js';
import { applyDocumentStyle, decodeDocument, encodeDocument, DEFAULT_SETTINGS, type DocumentSettings } from './document.js';
import { inspectOutput, waitForImages, type ExportIssue } from './preflight.js';
import { renderMarkdown } from './markdown.js';
import { PageManager } from './pages.js';
import {
  UIController,
  type DocumentListItem,
  type ExportModalContext,
  type ExportScope,
  type UploadedMarkdownFile,
} from './ui.js';

// Extend window interface for KaTeX
declare global {
  interface Window {
    katex: unknown;
  }
}

// Use the same bundled renderer for authoring, page previews and PDF export.
window.katex = bundledKatex;

type ManagedDocument = StoredDocument;

class MD2PDFApp {
  private editor!: MarkdownEditor;
  private pageManager!: PageManager;
  private ui!: UIController;
  private tools!: WorkspaceTools;
  private store?: WorkspaceStore;
  private restoring = true;
  private saveTimer = 0;
  private saveRevision = 0;
  private savedRevision = 0;
  private loadedImages = new Set<string>();

  private documents: ManagedDocument[] = [];
  private activeDocumentId: string | null = null;
  private isSwitchingDocument = false;
  private isExporting = false;
  private untitledCounter = 1;

  constructor() {
    try {
      this.editor = new MarkdownEditor('markdownEditor');
      new AuthoringTools(this.editor);
      this.pageManager = new PageManager('previewContainer');
      this.ui = new UIController();
      this.tools = new WorkspaceTools(this.editor, {
        getSettings: () => ({ ...(this.getActiveDocument()?.settings ?? DEFAULT_SETTINGS) }),
        setSettings: settings => {
          let active = this.getActiveDocument();
          if (!active) { active = this.createDocument(this.nextUntitledFilename(), this.editor.getContent()); this.documents.push(active); this.activeDocumentId = active.id; }
          active.settings = settings;
          this.renderActiveDocument(); this.refreshDocumentList();
        },
        getFilename: () => this.getActiveDocument()?.filename ?? 'Untitled.md',
        importFiles: files => this.addUploadedDocuments(files),
        newDocument: () => {
          this.syncActiveDocumentContentFromEditor();
          const next = this.createDocument(this.makeUniqueFilename(this.nextUntitledFilename()), '');
          this.documents.push(next); this.switchActiveDocument(next.id, true); this.editor.focus();
        },
        checkOutput: all => this.checkOutput(all),
        goToIssue: issue => {
          if (issue.documentId && issue.documentId !== this.activeDocumentId) this.switchActiveDocument(issue.documentId);
          this.tools.navigation.goTo(issue.source);
        },
      });

      this.initializeDocuments();
      this.setupEventHandlers();
      void this.restoreWorkspace();

      const equationDialog = document.querySelector<HTMLDialogElement>('.equation-dialog')!;
      equationDialog.addEventListener('equation-open', () => {
        void import('./visual-math.js').then(module => module.installVisualMath(equationDialog)).catch(error => console.error('Visual math editor could not load:', error));
      });
      const textarea = document.getElementById('markdownEditor') as HTMLTextAreaElement;
      for (const event of ['click', 'keyup', 'select', 'scroll']) textarea.addEventListener(event, () => this.scheduleSave());
      window.addEventListener('pointerup', () => this.scheduleSave());
      document.getElementById('sidebarToggleBtn')!.addEventListener('click', () => this.scheduleSave());
      document.getElementById('syncScroll')!.addEventListener('click', () => this.scheduleSave());
      window.addEventListener('pagehide', () => { void this.flushSave(); });
      window.addEventListener('beforeunload', event => {
        if (this.savedRevision !== this.saveRevision) { void this.flushSave(); event.preventDefault(); event.returnValue = ''; }
      });
      void document.fonts.ready.then(() => { if (!this.restoring) this.renderActiveDocument(); });

      {
        const note = document.createElement('p'); note.id = 'hostingNotice';
        note.textContent = 'Markdown PDFs: Print → Save as PDF. Files stay in this browser; save a Markdown file or package ZIP to move between PCs. No account or server required.';
        const sourceLink = document.createElement('a'); sourceLink.href = 'https://github.com/LightningPhil/MD2PDF'; sourceLink.textContent = ' Source · MIT license'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; note.append(sourceLink);
        document.getElementById('app')!.append(note);
      }
      console.log('MD2PDF App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MD2PDF App:', error);
      this.showError('Failed to initialize application');
    }
  }

  /**
   * Sets up event handlers between components
   */
  private setupEventHandlers(): void {
    this.editor.onChange((content) => {
      if (this.isSwitchingDocument) {
        return;
      }

      const decoded = decodeDocument(content);
      if (decoded.hasSettings) {
        this.isSwitchingDocument = true; this.editor.setContent(decoded.content); this.isSwitchingDocument = false;
        content = decoded.content;
      }
      let active = this.getActiveDocument();
      if (!active && content.trim()) {
        active = this.createDocument(this.nextUntitledFilename(), content);
        this.documents.push(active);
        this.activeDocumentId = active.id;
      }

      if (!active) {
        this.pageManager.updatePages(document.createElement('div'));
        this.ui.refreshPreviewViewport();
        this.refreshDocumentList();
        return;
      }

      active.content = content;
      if (decoded.hasSettings) active.settings = decoded.settings;
      this.renderActiveDocument();
      this.refreshDocumentList();
    });

    this.ui.onFileUpload((files) => {
      this.addUploadedDocuments(files);
    });

    this.ui.onDocumentSelect((documentId) => {
      this.switchActiveDocument(documentId);
    });

    this.ui.onDocumentRename((documentId, nextFilename) => {
      this.renameDocument(documentId, nextFilename);
    });

    this.ui.onDocumentClose((documentId) => {
      this.closeDocument(documentId);
    });

    this.ui.onFileSave(() => {
      this.syncActiveDocumentContentFromEditor();
      const active = this.getActiveDocument();
      return {
        content: /\.tex$/i.test(active?.filename ?? '') ? active!.content : encodeDocument(active?.content ?? '', active?.settings ?? DEFAULT_SETTINGS),
        filename: active ? this.ensureMarkdownFilename(active.filename) : 'document.md',
      };
    });

    this.ui.onExportContextRequest(() => {
      void this.tools.refreshExportChecks();
      return this.buildExportModalContext();
    });

    this.ui.onExportStart((scope) => {
      void this.exportDocuments(scope);
    });


    this.ui.onMathModeChange((mode) => {
      this.pageManager.setMathMode(mode);
      this.renderActiveDocument();
      this.recomputeInactivePageCounts();
      this.refreshDocumentList();
      console.log(`Math mode changed to: ${mode}`);
    });

    this.ui.onSettingsChange(() => {
      const active = this.getActiveDocument();
      if (active) active.settings = { ...active.settings, fontSize: this.ui.getFontSize(), margin: this.ui.getMargin(), pageSize: this.ui.getPageSize(), preset: 'custom' };
      this.renderActiveDocument();
      this.recomputeInactivePageCounts();
      this.refreshDocumentList();
      console.log('Settings changed, re-rendering preview');
    });
  }

  private initializeDocuments(): void {
    const initialContent = this.editor.getContent();
    if (initialContent.trim()) {
      const initialDocument = this.createDocument(this.nextUntitledFilename(), initialContent);
      this.documents = [initialDocument];
      this.activeDocumentId = initialDocument.id;
      return;
    }

    this.documents = [];
    this.activeDocumentId = null;
  }

  private addUploadedDocuments(files: UploadedMarkdownFile[]): void {
    if (files.length === 0) {
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    const addedDocuments: ManagedDocument[] = [];
    files.forEach((file) => {
      const uniqueName = this.makeUniqueFilename(file.filename);
      const document = this.createDocument(uniqueName, file.content);
      this.documents.push(document);
      addedDocuments.push(document);
    });

    if (addedDocuments.length > 0) {
      this.switchActiveDocument(addedDocuments[0].id, true);
      this.recomputeInactivePageCounts();
      this.refreshDocumentList();
    }
  }

  private switchActiveDocument(documentId: string, skipSync = false): void {
    const target = this.getDocumentById(documentId);
    if (!target) {
      return;
    }

    if (!skipSync) {
      this.syncActiveDocumentContentFromEditor();
    }

    this.activeDocumentId = target.id;

    this.isSwitchingDocument = true;
    this.editor.setContent(target.content);
    this.editor.setSelection(target.cursor.start, target.cursor.end);
    this.isSwitchingDocument = false;

    this.renderActiveDocument();
    this.refreshDocumentList();
    const textarea = document.getElementById('markdownEditor') as HTMLTextAreaElement;
    textarea.scrollTop = target.cursor.scrollTop;
  }

  private renameDocument(documentId: string, requestedFilename: string): void {
    const target = this.getDocumentById(documentId);
    if (!target) {
      return;
    }

    const trimmed = (requestedFilename || '').trim();
    if (!trimmed) {
      this.showError('Filename cannot be empty');
      return;
    }

    const normalized = this.ensureMarkdownFilename(trimmed);
    const unique = this.makeUniqueFilename(normalized, target.id);
    if (unique === target.filename) {
      return;
    }

    target.filename = unique;
    this.refreshDocumentList();
    this.renderActiveDocument();
    this.ui.showNotification(`Renamed to ${unique}`, 'success');
  }

  private closeDocument(documentId: string): void {
    const closingIndex = this.documents.findIndex((documentItem) => documentItem.id === documentId);
    if (closingIndex < 0) {
      return;
    }

    const closingDocument = this.documents[closingIndex];
    if (closingDocument.id === this.activeDocumentId) {
      this.syncActiveDocumentContentFromEditor();
    }

    this.documents.splice(closingIndex, 1);

    if (this.documents.length === 0) {
      this.activeDocumentId = null;

      this.isSwitchingDocument = true;
      this.editor.setContent('');
      this.isSwitchingDocument = false;

      this.pageManager.updatePages(document.createElement('div'));
      this.ui.refreshPreviewViewport();
      this.refreshDocumentList();
      this.ui.showNotification(`Closed ${closingDocument.filename}`, 'info');
      return;
    }

    if (closingDocument.id === this.activeDocumentId) {
      const replacementIndex = Math.min(closingIndex, this.documents.length - 1);
      const replacement = this.documents[replacementIndex];
      this.activeDocumentId = replacement.id;

      this.isSwitchingDocument = true;
      this.editor.setContent(replacement.content);
      this.editor.setSelection(replacement.cursor.start, replacement.cursor.end);
      this.isSwitchingDocument = false;

      this.renderActiveDocument();
      (document.getElementById('markdownEditor') as HTMLTextAreaElement).scrollTop = replacement.cursor.scrollTop;
    }

    this.refreshDocumentList();
    this.ui.showNotification(`Closed ${closingDocument.filename}`, 'info');
  }

  /**
   * Renders the active document in the preview pane and updates page count.
   */
  private renderActiveDocument(): void {
    try {
      const active = this.getActiveDocument();
      const settings = active?.settings ?? DEFAULT_SETTINGS;
      applyDocumentStyle(settings);
      this.ui.setDocumentPageSettings(settings);
      this.pageManager.setSettings(settings);
      if (!active) {
        this.pageManager.updatePages(document.createElement('div'));
        this.ui.refreshPreviewViewport();
        return;
      }

      const markdown = active.content;
      if (!markdown.trim() && !settings.titlePage) {
        this.pageManager.updatePages(document.createElement('div'));
        active.pageCount = this.pageManager.getPageCount();
        this.ui.refreshPreviewViewport();
        return;
      }

      const mathMode = this.pageManager.getMathMode();
      const htmlContent = renderMarkdown(markdown, { mathMode: { type: mathMode }, settings });

      this.pageManager.updatePages(htmlContent);
      active.pageCount = this.pageManager.getPageCount();
      this.ui.refreshPreviewViewport();
      this.warmImages(htmlContent);
    } catch (error) {
      console.error('Error updating preview:', error);
      this.showError('Failed to update preview');
    } finally {
      this.tools?.refresh();
    }
  }

  private recomputeInactivePageCounts(): void {
    const activeId = this.activeDocumentId;

    this.documents.forEach((documentItem) => {
      if (documentItem.id === activeId) {
        return;
      }

      documentItem.pageCount = this.calculatePageCountForMarkdown(documentItem.content, documentItem.settings);
    });
  }

  private calculatePageCountForMarkdown(markdown: string, settings: DocumentSettings): number {
    if (!markdown.trim()) {
      return 1;
    }

    const mathMode = this.pageManager.getMathMode();
    const savedStyle = document.documentElement.style.cssText;
    const htmlContent = renderMarkdown(markdown, { mathMode: { type: mathMode }, settings });
    try {
      applyDocumentStyle(settings); this.ui.setDocumentPageSettings(settings);
      return this.pageManager.calculatePageCount(htmlContent);
    } finally {
      this.ui.setDocumentPageSettings(this.getActiveDocument()?.settings ?? DEFAULT_SETTINGS);
      document.documentElement.style.cssText = savedStyle;
    }
  }

  private refreshDocumentList(): void {
    const items: DocumentListItem[] = this.documents.map((documentItem) => ({
      id: documentItem.id,
      filename: documentItem.filename,
      pageCount: Math.max(1, documentItem.pageCount),
      isActive: documentItem.id === this.activeDocumentId,
    }));

    this.ui.renderDocumentList(items);
    this.scheduleSave();
  }

  private buildExportModalContext(): ExportModalContext {
    const active = this.getActiveDocument();
    return {
      activeFilename: active?.filename ?? 'No active file',
      totalFiles: Math.max(0, this.documents.length),
    };
  }

  private getActiveDocument(): ManagedDocument | undefined {
    if (!this.activeDocumentId) {
      return undefined;
    }

    return this.documents.find((documentItem) => documentItem.id === this.activeDocumentId);
  }

  private getDocumentById(documentId: string): ManagedDocument | undefined {
    return this.documents.find((documentItem) => documentItem.id === documentId);
  }

  private syncActiveDocumentContentFromEditor(): void {
    const active = this.getActiveDocument();
    if (!active) {
      return;
    }

    active.content = this.editor.getContent();
    const textarea = document.getElementById('markdownEditor') as HTMLTextAreaElement;
    active.cursor = { ...this.editor.getSelection(), scrollTop: textarea.scrollTop };
  }

  private createDocument(filename: string, content: string): ManagedDocument {
    const decoded = decodeDocument(content);
    return {
      id: this.createDocumentId(),
      filename,
      content: decoded.content,
      pageCount: 1,
      settings: decoded.hasSettings ? decoded.settings : { ...(this.getActiveDocument()?.settings ?? DEFAULT_SETTINGS) },
      cursor: { start: 0, end: 0, scrollTop: 0 },
    };
  }

  private createDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private nextUntitledFilename(): string {
    const filename = this.untitledCounter === 1 ? 'Untitled.md' : `Untitled-${this.untitledCounter}.md`;
    this.untitledCounter += 1;
    return filename;
  }

  private makeUniqueFilename(requestedFilename: string, excludeDocumentId: string | null = null): string {
    const normalized = this.ensureMarkdownFilename(requestedFilename || this.nextUntitledFilename());

    const extension = pathExtension(normalized);
    const stem = normalized.slice(0, normalized.length - extension.length);

    let candidate = normalized;
    let counter = 1;

    const used = new Set(
      this.documents
        .filter((documentItem) => documentItem.id !== excludeDocumentId)
        .map((documentItem) => documentItem.filename.toLowerCase()),
    );
    while (used.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${stem} (${counter})${extension}`;
    }

    return candidate;
  }

  private ensureMarkdownFilename(filename: string): string {
    const trimmed = (filename || '').trim();
    if (!trimmed) {
      return this.nextUntitledFilename();
    }

    if (/\.(md|markdown|tex)$/i.test(trimmed)) {
      return trimmed;
    }

    return `${trimmed}.md`;
  }

  private async exportDocuments(scope: ExportScope): Promise<void> {
    if (this.isExporting) return;
    this.syncActiveDocumentContentFromEditor();
    const selected = scope === 'all' ? this.documents : this.getActiveDocument() ? [this.getActiveDocument()!] : [];
    this.isExporting = true; this.ui.setExportBusy(true);
    try {
      this.ui.setExportSummary('Preparing pages. Choose Save as PDF in the print dialog, with browser headers and footers turned off.');
      await prepareBrowserPrint(selected.map(item => ({ filename: item.filename, content: encodeDocument(item.content, item.settings) })));
      this.ui.setExportBusy(false); this.ui.dismissExportDialog();
      window.print();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare PDF pages.';
      this.ui.setExportSummary(message); this.showError(message);
    } finally { this.isExporting = false; this.ui.setExportBusy(false); }
  }

  private showError(message: string): void {
    this.ui.showNotification(message, 'error');
  }

  private async restoreWorkspace(): Promise<void> {
    const textarea = document.getElementById('markdownEditor') as HTMLTextAreaElement;
    textarea.disabled = true;
    document.body.classList.add('restoring-workspace');
    try {
      this.store = new WorkspaceStore();
      const saved = await this.store.load();
      if (saved) {
        this.documents = saved.documents;
        this.activeDocumentId = saved.activeDocumentId;
        this.untitledCounter = saved.untitledCounter;
        this.ui.restoreWorkspaceLayout(saved.split, saved.sidebarCollapsed);
        this.tools.navigation.syncEnabled = saved.syncScroll;
        this.tools.updateSyncButton();
        const active = this.getActiveDocument();
        this.isSwitchingDocument = true;
        this.editor.setContent(active?.content ?? '');
        this.editor.setSelection(active?.cursor.start ?? 0, active?.cursor.end ?? 0);
        this.isSwitchingDocument = false;
      }
      this.tools.setStatus(saved ? 'Workspace restored · saved locally' : 'Autosave ready');
    } catch (error) {
      this.store = undefined;
      this.tools.setStatus('Autosave unavailable · use Save to keep your work', true);
      console.error('Workspace storage unavailable:', error);
    } finally {
      this.renderActiveDocument();
      this.recomputeInactivePageCounts();
      this.refreshDocumentList();
      textarea.scrollTop = this.getActiveDocument()?.cursor.scrollTop ?? 0;
      textarea.disabled = false;
      this.restoring = false;
      document.body.classList.remove('restoring-workspace');
    }
  }

  private scheduleSave(): void {
    if (this.restoring) return;
    this.saveRevision++;
    this.tools.setStatus(this.store ? 'Saving locally…' : 'Autosave unavailable · use Save', !this.store);
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { void this.flushSave(); }, 250);
  }

  private async flushSave(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (this.restoring || !this.store || this.savedRevision === this.saveRevision) return;
    this.syncActiveDocumentContentFromEditor();
    const revision = this.saveRevision;
    const state: WorkspaceState = structuredClone({
      version: 1,
      documents: this.documents,
      activeDocumentId: this.activeDocumentId,
      untitledCounter: this.untitledCounter,
      split: getComputedStyle(document.documentElement).getPropertyValue('--split-ratio').trim(),
      sidebarCollapsed: document.getElementById('workspaceShell')!.classList.contains('sidebar-collapsed'),
      syncScroll: this.tools.navigation.syncEnabled,
    });
    try {
      await this.store.save(state);
      this.savedRevision = Math.max(this.savedRevision, revision);
      if (this.saveRevision === revision) this.tools.setStatus('Saved locally');
    } catch (error) {
      this.tools.setStatus('Local save failed · download your Markdown with Save', true);
      console.error('Workspace save failed:', error);
    }
  }

  private warmImages(content: HTMLElement): void {
    content.querySelectorAll<HTMLImageElement>('img').forEach(image => {
      if (!image.src || this.loadedImages.has(image.src)) return;
      this.loadedImages.add(image.src);
      const probe = new Image();
      probe.onload = () => { if (!this.restoring) this.renderActiveDocument(); };
      probe.src = image.src;
    });
  }

  private async checkOutput(all: boolean): Promise<ExportIssue[]> {
    this.syncActiveDocumentContentFromEditor();
    const documents = structuredClone(all ? this.documents : this.getActiveDocument() ? [this.getActiveDocument()!] : []);
    const issues: ExportIssue[] = [];
    await document.fonts.ready;
    for (const item of documents) {
      const content = renderMarkdown(item.content, { mathMode: { type: 'html' }, settings: item.settings });
      await waitForImages(content);
      const sandbox = document.createElement('div');
      sandbox.id = `check-${crypto.randomUUID()}`;
      sandbox.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;';
      document.body.append(sandbox);
      const savedStyle = document.documentElement.style.cssText;
      try {
        applyDocumentStyle(item.settings); this.ui.setDocumentPageSettings(item.settings);
        const manager = new PageManager(sandbox.id); manager.setSettings(item.settings); manager.updatePages(content);
        issues.push(...inspectOutput(sandbox, item.content).map(issue => ({ ...issue, documentId: item.id, filename: item.filename })));
      } finally {
        sandbox.remove();
        this.ui.setDocumentPageSettings(this.getActiveDocument()?.settings ?? DEFAULT_SETTINGS);
        document.documentElement.style.cssText = savedStyle;
      }
    }
    return issues;
  }
}

function pathExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return '.md';
  }
  return filename.slice(dotIndex);
}

// Wait for DOM to be loaded before initializing the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MD2PDFApp();
  });
} else {
  new MD2PDFApp();
}

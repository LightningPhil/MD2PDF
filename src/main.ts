import { defaultProject, type LatexProject } from './latex-project.js';
import { LatexWorkspace, isLatex, compileLatex } from './latex.js';
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

interface ExportPayloadBase {
  pageSize: string;
  fontSizePx: number;
  marginMm: number;
  mathMode: 'html' | 'svg';
}

interface ExportDocumentPayload {
  latexProject?: LatexProject;
  filename: string;
  content: string;
}

interface ExportJobStartPayload extends ExportPayloadBase {
  mode: ExportScope;
  document?: ExportDocumentPayload;
  documents?: ExportDocumentPayload[];
  zipFilename?: string;
}

interface ExportJobStartResponse {
  jobId: string;
}

interface ExportJobStatusResponse {
  jobId: string;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  processed: number;
  total: number;
  message: string;
  artifactName: string | null;
  nextCursor: number;
  logEntries: string[];
  error: string | null;
  elapsedMs: number;
  currentFileElapsedMs: number;
}

class ExportCanceledError extends Error {}

class MD2PDFApp {
  private editor!: MarkdownEditor;
  private latex!: LatexWorkspace;
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
  private activeExportJobId: string | null = null;
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
          if (issue.sourceFile && issue.line) this.latex.goToSource(issue.sourceFile, issue.line);
          else this.tools.navigation.goTo(issue.source);
        },
      });

      this.latex = new LatexWorkspace(this.editor,
        (filename, content) => this.addUploadedDocuments([{ filename, content }]),
        latex => {
          this.syncActiveDocumentContentFromEditor();
          let active = this.getActiveDocument();
          if (!active) { active = this.createDocument(this.nextUntitledFilename(), this.editor.getContent()); this.documents.push(active); this.activeDocumentId = active.id; }
          active.filename = this.makeUniqueFilename(active.filename.replace(/\.(md|markdown|tex)$/i, '') + (latex ? '.tex' : '.md'), active.id);
          this.renderActiveDocument(); this.refreshDocumentList();
        }, {
          get: () => this.getActiveDocument()?.latexProject ?? defaultProject(),
          set: project => { const active = this.getActiveDocument(); if (active) { active.latexProject = project; this.renderActiveDocument(); this.scheduleSave(); } },
          import: (source, project) => {
            this.addUploadedDocuments([{ filename: project.root.split('/').pop() || 'Project.tex', content: source }]);
            const active = this.getActiveDocument()!; active.latexProject = project; this.renderActiveDocument(); this.scheduleSave();
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
        content: isLatex(active?.filename) ? active!.content : encodeDocument(active?.content ?? '', active?.settings ?? DEFAULT_SETTINGS),
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

    this.ui.onExportCancel(() => {
      void this.cancelActiveExport();
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
      this.latex?.update('', '');

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
      this.latex?.update(active?.filename ?? '', active?.content ?? '');
      if (isLatex(active?.filename)) {
        this.pageManager.updatePages(document.createElement('div'));
        return;
      }
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
      if (documentItem.id === activeId || isLatex(documentItem.filename)) {
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

  private toPdfFilename(filename: string): string {
    const markdownName = this.ensureMarkdownFilename(filename);
    const extension = pathExtension(markdownName);
    const stem = markdownName.slice(0, markdownName.length - extension.length);
    return `${stem}.pdf`;
  }

  private getExportPayloadBase(): ExportPayloadBase {
    return {
      pageSize: this.ui.getPageSize(),
      fontSizePx: this.ui.getFontSize(),
      marginMm: this.ui.getMargin(),
      mathMode: this.ui.getMathMode(),
    };
  }

  private async exportDocuments(scope: ExportScope): Promise<void> {
    if (this.isExporting) {
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    const active = this.getActiveDocument();
    if (scope === 'current' && !active) {
      this.showError('No active markdown file to export');
      return;
    }

    const documents: ExportDocumentPayload[] = scope === 'current'
      ? [{
        filename: active?.filename ?? 'document.md',
        latexProject: active?.latexProject,
        content: isLatex(active?.filename) ? active!.content : encodeDocument(active?.content ?? '', active?.settings ?? DEFAULT_SETTINGS),
      }]
      : this.documents.map((documentItem) => ({
        filename: documentItem.filename,
        latexProject: documentItem.latexProject,
        content: isLatex(documentItem.filename) ? documentItem.content : encodeDocument(documentItem.content, documentItem.settings),
      }));

    if (documents.length === 0) {
      this.showError('No markdown files to export');
      return;
    }

    const totalFiles = scope === 'all' ? documents.length : 1;

    this.ui.clearExportLog();
    this.ui.setExportProgress({
      processed: 0,
      total: totalFiles,
      message: 'Preparing export job...',
    });
    this.ui.setExportSummary(
      scope === 'all'
        ? `Exporting ${documents.length} markdown files to a ZIP archive.`
        : `Exporting ${documents[0].filename} to PDF.`,
    );
    this.ui.appendExportLog('Preparing export job...');

    await this.runExport(async () => {
      const payload: ExportJobStartPayload = {
        ...this.getExportPayloadBase(),
        mode: scope,
        document: scope === 'current' ? documents[0] : undefined,
        documents: scope === 'all' ? documents : undefined,
        zipFilename: scope === 'all' ? 'md2pdf-export.zip' : undefined,
      };

      const start = await this.postJson<ExportJobStartResponse>('/api/export/job/start', payload);
      this.activeExportJobId = start.jobId;
      this.ui.appendExportLog(`Export job started (${start.jobId.slice(0, 8)}).`);

      const finalStatus = await this.pollExportJob(start.jobId, totalFiles);
      if (finalStatus.state === 'canceled') {
        this.ui.setExportSummary('Export canceled.');
        throw new ExportCanceledError('Export canceled.');
      }

      if (finalStatus.state === 'failed') {
        const message = finalStatus.error || 'Export failed';
        this.ui.setExportSummary(`Export failed: ${message}`);
        throw new Error(message);
      }

      const artifact = await this.getExportArtifact(start.jobId);
      const fallbackName = scope === 'all'
        ? 'md2pdf-export.zip'
        : this.toPdfFilename(documents[0].filename);
      const filename = this.extractFilenameFromContentDisposition(artifact.contentDisposition)
        || finalStatus.artifactName
        || fallbackName;

      this.downloadBlob(artifact.blob, filename);
      this.ui.appendExportLog(`Downloaded ${filename}.`);
      this.ui.setExportProgress({
        processed: Math.max(finalStatus.total, totalFiles),
        total: Math.max(finalStatus.total, totalFiles, 1),
        message: `Export complete: ${filename}`,
        totalElapsedMs: finalStatus.elapsedMs,
        currentFileElapsedMs: 0,
      });
      this.ui.setExportSummary(
        scope === 'all'
          ? `Finished exporting ${documents.length} files to ${filename}.`
          : `Finished exporting ${filename}.`,
      );
      this.ui.showNotification(
        scope === 'all'
          ? `Exported ${documents.length} files to ${filename}`
          : `Exported ${filename}`,
        'success',
      );
    });
  }

  private async cancelActiveExport(): Promise<void> {
    if (!this.isExporting || !this.activeExportJobId) {
      return;
    }

    try {
      await this.postJson('/api/export/job/cancel', { jobId: this.activeExportJobId });
      this.ui.appendExportLog('Cancel requested. Waiting for current file to finish...');
      this.ui.setExportSummary('Cancel requested. Finishing current task...');
    } catch (error) {
      console.error('Cancel export error:', error);
      const message = error instanceof Error ? error.message : 'Failed to cancel export';
      this.showError(message);
    }
  }

  private async pollExportJob(jobId: string, fallbackTotal: number): Promise<ExportJobStatusResponse> {
    let cursor = 0;

    while (true) {
      const status = await this.getJson<ExportJobStatusResponse>(
        `/api/export/job/status?jobId=${encodeURIComponent(jobId)}&cursor=${cursor}`,
      );

      cursor = status.nextCursor;
      status.logEntries.forEach((entry) => {
        this.ui.appendExportLog(entry);
      });

      const total = Math.max(1, status.total || fallbackTotal);
      const processed = Math.max(0, Math.min(status.processed, total));
      this.ui.setExportProgress({
        processed,
        total,
        message: status.message || this.describeExportState(status.state),
        totalElapsedMs: status.elapsedMs,
        currentFileElapsedMs: status.currentFileElapsedMs,
      });

      if (status.state === 'completed' || status.state === 'failed' || status.state === 'canceled') {
        return status;
      }

      await this.delay(250);
    }
  }

  private async runExport(task: () => Promise<void>): Promise<void> {
    this.isExporting = true;
    this.ui.setExportBusy(true);

    try {
      await task();
    } catch (error) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Export failed';

      if (error instanceof ExportCanceledError) {
        this.ui.setExportSummary(message);
        this.ui.showNotification(message, 'info');
      } else {
        this.ui.setExportSummary(`Export failed: ${message}`);
        this.showError(message);
      }
    } finally {
      this.activeExportJobId = null;
      this.isExporting = false;
      this.ui.setExportBusy(false);
    }
  }

  private describeExportState(state: ExportJobStatusResponse['state']): string {
    if (state === 'queued') {
      return 'Queued...';
    }
    if (state === 'running') {
      return 'Processing files...';
    }
    if (state === 'completed') {
      return 'Export complete';
    }
    if (state === 'canceled') {
      return 'Export canceled';
    }
    return 'Export failed';
  }

  private async postJson<T = unknown>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await this.readErrorMessage(response);
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async getJson<T = unknown>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await this.readErrorMessage(response);
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }

  private async getExportArtifact(jobId: string): Promise<{ blob: Blob; contentDisposition: string | null }> {
    const response = await fetch(`/api/export/job/download?jobId=${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await this.readErrorMessage(response);
      throw new Error(errorText || `Download failed with status ${response.status}`);
    }

    return {
      blob: await response.blob(),
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const raw = (await response.text()).trim();
    if (!raw) {
      return '';
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const error = parsed.error;
      if (typeof error === 'string' && error.trim()) {
        return error;
      }

      const message = parsed.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    } catch {
      // Raw response was not JSON.
    }

    return raw;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private extractFilenameFromContentDisposition(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const basicMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    if (basicMatch?.[1]) {
      return basicMatch[1];
    }

    return null;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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
      if (isLatex(item.filename)) {
        try {
          const result = await compileLatex(item.content, item.latexProject);
          issues.push(...result.diagnostics.map(issue => ({ message: issue.message, severity: issue.severity, sourceFile: issue.file || item.latexProject?.main || 'main.tex', line: issue.line, source: item.content.split('\n').slice(0, issue.line - 1).reduce((n, line) => n + line.length + 1, 0), documentId: item.id, filename: item.filename })));
          if (!result.success && !result.diagnostics.length) issues.push({ message: result.log || 'Compilation failed.', severity: 'error', source: 0, documentId: item.id, filename: item.filename });
        } catch (error) { issues.push({ message: String(error), severity: 'error', source: 0, documentId: item.id, filename: item.filename }); }
        continue;
      }
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

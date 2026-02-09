import { MarkdownEditor } from './editor.js';
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

interface ManagedDocument {
  id: string;
  filename: string;
  content: string;
  pageCount: number;
}

interface ExportPayloadBase {
  pageSize: string;
  fontSizePx: number;
  marginMm: number;
  mathMode: 'html' | 'svg';
}

interface ExportDocumentPayload {
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
  private pageManager!: PageManager;
  private ui!: UIController;

  private documents: ManagedDocument[] = [];
  private activeDocumentId: string | null = null;
  private isSwitchingDocument = false;
  private isExporting = false;
  private activeExportJobId: string | null = null;
  private untitledCounter = 1;

  constructor() {
    try {
      this.editor = new MarkdownEditor('markdownEditor');
      this.pageManager = new PageManager('previewContainer');
      this.ui = new UIController();

      this.initializeDocuments();
      this.setupEventHandlers();
      this.renderActiveDocument();
      this.recomputeInactivePageCounts();
      this.refreshDocumentList();

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
      this.renderActiveDocument();
      this.refreshDocumentList();
    });

    this.editor.onCursorLineChange((lineNumber) => {
      this.focusPreviewForEditorLine(lineNumber);
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
        content: active?.content ?? '',
        filename: active ? this.ensureMarkdownFilename(active.filename) : 'document.md',
      };
    });

    this.ui.onExportContextRequest(() => this.buildExportModalContext());

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
    this.isSwitchingDocument = false;

    this.renderActiveDocument();
    this.refreshDocumentList();
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
      this.isSwitchingDocument = false;

      this.renderActiveDocument();
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
      if (!active) {
        this.pageManager.updatePages(document.createElement('div'));
        this.ui.refreshPreviewViewport();
        return;
      }

      const markdown = active.content;
      if (!markdown.trim()) {
        this.pageManager.updatePages(document.createElement('div'));
        active.pageCount = this.pageManager.getPageCount();
        this.ui.refreshPreviewViewport();
        return;
      }

      const mathMode = this.pageManager.getMathMode();
      const htmlContent = renderMarkdown(markdown, { mathMode: { type: mathMode } });

      this.pageManager.updatePages(htmlContent);
      active.pageCount = this.pageManager.getPageCount();
      this.ui.refreshPreviewViewport();
    } catch (error) {
      console.error('Error updating preview:', error);
      this.showError('Failed to update preview');
    }
  }

  private recomputeInactivePageCounts(): void {
    const activeId = this.activeDocumentId;

    this.documents.forEach((documentItem) => {
      if (documentItem.id === activeId) {
        return;
      }

      documentItem.pageCount = this.calculatePageCountForMarkdown(documentItem.content);
    });
  }

  private calculatePageCountForMarkdown(markdown: string): number {
    if (!markdown.trim()) {
      return 1;
    }

    const mathMode = this.pageManager.getMathMode();
    const htmlContent = renderMarkdown(markdown, { mathMode: { type: mathMode } });
    return this.pageManager.calculatePageCount(htmlContent);
  }

  private refreshDocumentList(): void {
    const items: DocumentListItem[] = this.documents.map((documentItem) => ({
      id: documentItem.id,
      filename: documentItem.filename,
      pageCount: Math.max(1, documentItem.pageCount),
      isActive: documentItem.id === this.activeDocumentId,
    }));

    this.ui.renderDocumentList(items);
  }

  private buildExportModalContext(): ExportModalContext {
    const active = this.getActiveDocument();
    return {
      activeFilename: active?.filename ?? 'No active file',
      totalFiles: Math.max(0, this.documents.length),
    };
  }

  private focusPreviewForEditorLine(lineNumber: number): void {
    if (this.isSwitchingDocument) {
      return;
    }

    const active = this.getActiveDocument();
    if (!active || !active.content.trim()) {
      return;
    }

    this.ui.focusPreviewOnSourceLine(lineNumber);
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
  }

  private createDocument(filename: string, content: string): ManagedDocument {
    return {
      id: this.createDocumentId(),
      filename,
      content,
      pageCount: 1,
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

    if (/\.(md|markdown)$/i.test(trimmed)) {
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
        content: active?.content ?? '',
      }]
      : this.documents.map((documentItem) => ({
        filename: documentItem.filename,
        content: documentItem.content,
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

// Load KaTeX library if not already loaded
if (typeof window !== 'undefined' && !window.katex) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.js';
  script.onload = () => {
    console.log('KaTeX library loaded');
  };
  script.onerror = () => {
    console.error('Failed to load KaTeX library');
  };
  document.head.appendChild(script);
}

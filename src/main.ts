import { MarkdownEditor } from './editor.js';
import { renderMarkdown } from './markdown.js';
import { PageManager } from './pages.js';
import { UIController, type DocumentListItem, type UploadedMarkdownFile } from './ui.js';

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

class MD2PDFApp {
  private editor!: MarkdownEditor;
  private pageManager!: PageManager;
  private ui!: UIController;

  private documents: ManagedDocument[] = [];
  private activeDocumentId: string | null = null;
  private isSwitchingDocument = false;
  private isExporting = false;
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

      const active = this.getActiveDocument();
      if (!active) {
        return;
      }

      active.content = content;
      this.renderActiveDocument();
      this.refreshDocumentList();
    });

    this.ui.onFileUpload((files) => {
      this.addUploadedDocuments(files);
    });

    this.ui.onDocumentSelect((documentId) => {
      this.switchActiveDocument(documentId);
    });

    this.ui.onFileSave(() => {
      this.syncActiveDocumentContentFromEditor();
      const active = this.getActiveDocument();
      return {
        content: active?.content ?? '',
        filename: active ? this.ensureMarkdownFilename(active.filename) : 'document.md',
      };
    });

    this.ui.onExportCurrentPdf(() => {
      void this.exportCurrentDocumentPdf();
    });

    this.ui.onExportAllPdf(() => {
      void this.exportAllDocumentsPdf();
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
    const initialDocument = this.createDocument(this.nextUntitledFilename(), initialContent);
    this.documents = [initialDocument];
    this.activeDocumentId = initialDocument.id;
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

  private makeUniqueFilename(requestedFilename: string): string {
    const normalized = this.ensureMarkdownFilename(requestedFilename || this.nextUntitledFilename());

    const extension = pathExtension(normalized);
    const stem = normalized.slice(0, normalized.length - extension.length);

    let candidate = normalized;
    let counter = 1;

    const used = new Set(this.documents.map((documentItem) => documentItem.filename.toLowerCase()));
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

  private async exportCurrentDocumentPdf(): Promise<void> {
    if (this.isExporting) {
      return;
    }

    const active = this.getActiveDocument();
    if (!active) {
      this.showError('No active markdown file to export');
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    await this.runExport(async () => {
      const payload = {
        ...this.getExportPayloadBase(),
        filename: active.filename,
        content: active.content,
      };

      const { blob, contentDisposition } = await this.postForBlob('/api/export/pdf-single', payload);
      const fallbackName = this.toPdfFilename(active.filename);
      const filename = this.extractFilenameFromContentDisposition(contentDisposition) || fallbackName;

      this.downloadBlob(blob, filename);
      this.ui.showNotification(`Exported ${filename}`, 'success');
    });
  }

  private async exportAllDocumentsPdf(): Promise<void> {
    if (this.isExporting) {
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    const documents = this.documents.map((documentItem) => ({
      filename: documentItem.filename,
      content: documentItem.content,
    }));

    if (documents.length === 0) {
      this.showError('No markdown files to export');
      return;
    }

    await this.runExport(async () => {
      const payload = {
        ...this.getExportPayloadBase(),
        zipFilename: 'md2pdf-export.zip',
        documents,
      };

      const { blob, contentDisposition } = await this.postForBlob('/api/export/pdf-all', payload);
      const filename = this.extractFilenameFromContentDisposition(contentDisposition) || 'md2pdf-export.zip';

      this.downloadBlob(blob, filename);
      this.ui.showNotification(`Exported ${documents.length} files to ${filename}`, 'success');
    });
  }

  private async runExport(task: () => Promise<void>): Promise<void> {
    this.isExporting = true;
    this.ui.setExportBusy(true);

    try {
      await task();
    } catch (error) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Export failed';
      this.showError(message);
    } finally {
      this.isExporting = false;
      this.ui.setExportBusy(false);
    }
  }

  private async postForBlob(url: string, payload: unknown): Promise<{ blob: Blob; contentDisposition: string | null }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Export request failed with status ${response.status}`);
    }

    return {
      blob: await response.blob(),
      contentDisposition: response.headers.get('content-disposition'),
    };
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

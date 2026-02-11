import JSZip from 'jszip';
import { MarkdownEditor } from './editor.js';
import { PageManager } from './pages.js';
import type { PageSizeKey } from './typesetter.js';
import {
  UIController,
  type DocumentListItem,
  type ExportModalContext,
  type ExportScope,
  type UploadedMarkdownFile,
} from './ui.js';

interface ManagedDocument {
  id: string;
  filename: string;
  content: string;
  pageCount: number;
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
      void this.recomputeInactivePageCounts();
      this.refreshDocumentList();
      
      // PDF export is always available now (client-side)
      this.ui.updateExportAvailability(true);
    } catch (error) {
      console.error('Failed to initialize MD2PDF App:', error);
      this.showError('Failed to initialize application');
    }
  }

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
        void this.pageManager.updateMarkdown('');
        this.ui.refreshPreviewViewport();
        this.refreshDocumentList();
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
      // Client-side export is fast, no cancel needed
    });

    // Math mode is now handled by typesetter, no separate toggle needed
    this.ui.onMathModeChange(() => {
      // No-op - typesetter handles math natively
    });

    this.ui.onSettingsChange(() => {
      this.applySettings();
      this.renderActiveDocument();
      void this.recomputeInactivePageCounts();
      this.refreshDocumentList();
    });

    this.ui.onHeaderFooterChange(() => {
      this.applyHeaderFooter();
      this.renderActiveDocument();
      void this.recomputeInactivePageCounts();
      this.refreshDocumentList();
    });

    // Bidirectional scroll sync: canvas click -> editor
    this.pageManager.getCanvas().addEventListener('click', (event) => {
      const canvas = this.pageManager.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const canvasY = event.clientY - rect.top;
      const unscaledCanvasY = this.ui.toUnscaledCanvasY(canvasY);
      const sourceLine = this.pageManager.getSourceLineFromCanvasY(unscaledCanvasY);
      if (sourceLine !== null) {
        this.editor.revealLine(sourceLine);
      }
    });

    // Bidirectional scroll sync: editor cursor -> preview (debounced)
    let scrollSyncTimeout: ReturnType<typeof setTimeout> | null = null;
    this.editor.onCursorLineChange((lineNumber) => {
      if (scrollSyncTimeout) {
        clearTimeout(scrollSyncTimeout);
      }
      scrollSyncTimeout = setTimeout(() => {
        const result = this.pageManager.getCanvasYFromSourceLine(lineNumber);
        if (result !== null) {
          this.ui.scrollPreviewToY(result.y);
          this.ui.highlightCanvasRegion(result.y, result.height);
        }
      }, 150);
    });
  }

  private applyHeaderFooter(): void {
    const hfConfig = this.ui.getHeaderFooterConfig();
    this.pageManager.setHeaderFooter(hfConfig);
  }

  private applySettings(): void {
    const pageSize = this.ui.getPageSize() as PageSizeKey;
    const fontSizePx = this.ui.getFontSize();
    const marginMm = this.ui.getMargin();
    const emojiMode = this.ui.getEmojiMode();

    this.pageManager.setPageSize(pageSize);
    this.pageManager.setFontSize(fontSizePx);
    this.pageManager.setMargin(marginMm);
    this.pageManager.setEmojiMode(emojiMode);
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
      void this.recomputeInactivePageCounts();
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

    // Update document title for header/footer
    this.ui.setDocumentTitle(target.filename.replace(/\.md$/i, ''));
    this.pageManager.setDocumentTitle(target.filename.replace(/\.md$/i, ''));

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
    const closingIndex = this.documents.findIndex((doc) => doc.id === documentId);
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

      void this.pageManager.updateMarkdown('');
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

  private renderActiveDocument(): void {
    const active = this.getActiveDocument();
    if (!active) {
      void this.pageManager.updateMarkdown('');
      this.ui.refreshPreviewViewport();
      return;
    }

    void this.pageManager.updateMarkdown(active.content).then(() => {
      active.pageCount = this.pageManager.getPageCount();
      this.ui.refreshPreviewViewport();
      this.refreshDocumentList();
    });
  }

  private async recomputeInactivePageCounts(): Promise<void> {
    const activeId = this.activeDocumentId;

    for (const doc of this.documents) {
      if (doc.id === activeId) {
        continue;
      }

      doc.pageCount = await this.pageManager.calculatePageCount(doc.content);
    }

    this.refreshDocumentList();
  }

  private refreshDocumentList(): void {
    const items: DocumentListItem[] = this.documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      pageCount: Math.max(1, doc.pageCount),
      isActive: doc.id === this.activeDocumentId,
    }));

    this.ui.renderDocumentList(items);
  }

  private buildExportModalContext(): ExportModalContext {
    const active = this.getActiveDocument();
    return {
      activeFilename: active?.filename ?? 'No active file',
      totalFiles: Math.max(0, this.documents.length),
      isApiAvailable: true, // Always available now
    };
  }

  private getActiveDocument(): ManagedDocument | undefined {
    if (!this.activeDocumentId) {
      return undefined;
    }

    return this.documents.find((doc) => doc.id === this.activeDocumentId);
  }

  private getDocumentById(documentId: string): ManagedDocument | undefined {
    return this.documents.find((doc) => doc.id === documentId);
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
        .filter((doc) => doc.id !== excludeDocumentId)
        .map((doc) => doc.filename.toLowerCase()),
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

    const documentsToExport = scope === 'current'
      ? [active!]
      : this.documents;

    if (documentsToExport.length === 0) {
      this.showError('No markdown files to export');
      return;
    }

    this.isExporting = true;
    this.ui.setExportBusy(true);
    this.ui.clearExportLog();

    try {
      const totalFiles = documentsToExport.length;
      this.ui.setExportProgress({
        processed: 0,
        total: totalFiles,
        message: 'Generating PDF...',
      });
      this.ui.setExportSummary(
        scope === 'all'
          ? `Exporting ${totalFiles} markdown files...`
          : `Exporting ${documentsToExport[0].filename}...`,
      );

      if (scope === 'current') {
        // Single file export
        const doc = documentsToExport[0];
        this.ui.appendExportLog(`Generating PDF for ${doc.filename}...`);

        // Update PageManager with the document content and export
        await this.pageManager.updateMarkdown(doc.content);
        const pdfBytes = await this.pageManager.exportPdf(doc.filename);
        
        const filename = this.toPdfFilename(doc.filename);
        this.downloadPdf(pdfBytes, filename);

        this.ui.appendExportLog(`Downloaded ${filename}`);
        this.ui.setExportProgress({
          processed: 1,
          total: 1,
          message: `Export complete: ${filename}`,
        });
        this.ui.setExportSummary(`Finished exporting ${filename}.`);
        this.ui.showNotification(`Exported ${filename}`, 'success');
      } else {
        // Multiple files - bundle into a single zip
        const zip = new JSZip();
        
        for (let i = 0; i < documentsToExport.length; i++) {
          const doc = documentsToExport[i];
          this.ui.appendExportLog(`Generating PDF for ${doc.filename}...`);

          await this.pageManager.updateMarkdown(doc.content);
          const pdfBytes = await this.pageManager.exportPdf(doc.filename);
          
          const filename = this.toPdfFilename(doc.filename);
          zip.file(filename, pdfBytes);

          this.ui.setExportProgress({
            processed: i + 1,
            total: totalFiles,
            message: `Exported ${i + 1} of ${totalFiles}`,
          });
          this.ui.appendExportLog(`Added ${filename} to archive`);
        }

        this.ui.appendExportLog('Creating zip archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        this.downloadBlob(zipBlob, 'markdown-export.zip');

        this.ui.setExportSummary(`Finished exporting ${totalFiles} files as zip.`);
        this.ui.showNotification(`Exported ${totalFiles} files as zip`, 'success');
      }
    } catch (error) {
      console.error('Export error:', error);
      const message = error instanceof Error ? error.message : 'Export failed';
      this.ui.setExportSummary(`Export failed: ${message}`);
      this.showError(message);
    } finally {
      this.isExporting = false;
      this.ui.setExportBusy(false);
      
      // Re-render active document
      this.renderActiveDocument();
    }
  }

  private downloadPdf(pdfBytes: Uint8Array, filename: string): void {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
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

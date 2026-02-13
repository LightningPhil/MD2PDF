import JSZip from 'jszip';
import { MarkdownEditor } from './editor.js';
import { PageManager } from './pages.js';
import { downloadFile } from './utils/dom.js';
import type { PageSizeKey } from './typesetter.js';
import {
  UIController,
  type DocumentListItem,
  type ExportModalContext,
  type ExportScope,
} from './ui.js';
import { DocumentService } from './services/index.js';

class MD2PDFApp {
  private editor!: MarkdownEditor;
  private pageManager!: PageManager;
  private ui!: UIController;
  private documentService!: DocumentService;

  private isSwitchingDocument = false;
  private isExporting = false;
  private previewSyncTimeout: number | null = null;

  constructor() {
    try {
      this.editor = new MarkdownEditor('markdownEditor');
      this.pageManager = new PageManager('previewContainer');
      this.ui = new UIController();
      this.documentService = new DocumentService();

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

      let active = this.documentService.getActive();
      if (!active && content.trim()) {
        active = this.documentService.createDocument(this.documentService.nextUntitledFilename(), content);
        this.documentService.addDocument(active);
        this.documentService.setActiveId(active.id);
      }

      if (!active) {
        void this.pageManager.updateMarkdown('');
        this.ui.refreshPreviewViewport();
        this.refreshDocumentList();
        return;
      }

      this.documentService.updateContent(active.id, content);
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
      const active = this.documentService.getActive();
      return {
        content: active?.content ?? '',
        filename: active ? this.documentService.ensureMarkdownFilename(active.filename) : 'document.md',
      };
    });

    this.ui.onExportContextRequest(() => this.buildExportModalContext());

    this.ui.onExportStart((scope) => {
      void this.exportDocuments(scope);
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

    this.ui.onTypographySettingsChange((settings) => {
      this.pageManager.setTypographySettings({
        baseFontSizePt: settings.baseFontSizePt,
        h1Scale: settings.h1Scale,
        h2Scale: settings.h2Scale,
        h3Scale: settings.h3Scale,
        lineHeight: settings.lineHeight,
        paragraphSpacingPt: settings.paragraphSpacingPt,
        codeFontSizePt: settings.codeFontSizePt,
        tableFontSizePt: settings.tableFontSizePt,
        headerFooterFontSizePt: settings.headerFooterFontSizePt,
        linkUnderline: settings.linkUnderline,
        codeBlockBackground: settings.codeBlockBackground,
        codeBlockBorder: settings.codeBlockBorder,
        codeBlockLineNumbers: settings.codeBlockLineNumbers,
      });
      void this.recomputeInactivePageCounts();
      this.refreshDocumentList();
    });

    // Bidirectional scroll sync: canvas click -> editor
    this.pageManager.getCanvas().addEventListener('click', (event) => {
      const clickSyncMode = this.ui.getClickSyncMode();
      if (clickSyncMode === 'off') {
        return;
      }
      if (clickSyncMode === 'ctrl' && !event.ctrlKey && !event.metaKey) {
        return;
      }

      const canvas = this.pageManager.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const canvasY = event.clientY - rect.top;
      const unscaledCanvasY = this.ui.toUnscaledCanvasY(canvasY);
      const sourceLine = this.pageManager.getSourceLineFromCanvasY(unscaledCanvasY);
      if (sourceLine !== null) {
        this.editor.revealLine(sourceLine);
      }
    });

    this.editor.onCursorLineChange((lineNumber) => {
      this.schedulePreviewSync(lineNumber, true);
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
      const initialDocument = this.documentService.createDocument(
        this.documentService.nextUntitledFilename(),
        initialContent
      );
      this.documentService.addDocument(initialDocument);
      this.documentService.setActiveId(initialDocument.id);
      return;
    }

    this.documentService.clear();
  }

  private addUploadedDocuments(files: { filename: string; content: string }[]): void {
    if (files.length === 0) {
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    const result = this.documentService.addUploadedFiles(files);

    if (result.firstDocumentId) {
      this.switchActiveDocument(result.firstDocumentId, true);
      void this.recomputeInactivePageCounts();
      this.refreshDocumentList();
    }
  }

  private switchActiveDocument(documentId: string, skipSync = false): void {
    const target = this.documentService.getById(documentId);
    if (!target) {
      return;
    }

    if (!skipSync) {
      this.syncActiveDocumentContentFromEditor();
    }

    this.documentService.setActiveId(target.id);

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
    const result = this.documentService.renameDocument(documentId, requestedFilename);
    
    if (!result.success) {
      if (result.error) {
        this.showError(result.error);
      }
      return;
    }

    this.refreshDocumentList();
    if (result.newName) {
      this.ui.showNotification(`Renamed to ${result.newName}`, 'success');
    }
  }

  private closeDocument(documentId: string): void {
    // Sync before closing if this is the active document
    const closingDoc = this.documentService.getById(documentId);
    if (closingDoc && closingDoc.id === this.documentService.getActiveId()) {
      this.syncActiveDocumentContentFromEditor();
    }

    const result = this.documentService.removeDocument(documentId);
    
    if (!result.closed) {
      return;
    }

    if (result.isEmpty) {
      this.isSwitchingDocument = true;
      this.editor.setContent('');
      this.isSwitchingDocument = false;

      void this.pageManager.updateMarkdown('');
      this.ui.refreshPreviewViewport();
      this.refreshDocumentList();
      this.ui.showNotification(`Closed ${result.closed.filename}`, 'info');
      return;
    }

    // If we closed the active doc, switch to the next one
    if (result.nextActiveId && result.nextActiveId !== documentId) {
      const replacement = this.documentService.getById(result.nextActiveId);
      if (replacement) {
        this.isSwitchingDocument = true;
        this.editor.setContent(replacement.content);
        this.isSwitchingDocument = false;
        this.renderActiveDocument();
      }
    }

    this.refreshDocumentList();
    this.ui.showNotification(`Closed ${result.closed.filename}`, 'info');
  }

  private renderActiveDocument(): void {
    const active = this.documentService.getActive();
    if (!active) {
      void this.pageManager.updateMarkdown('');
      this.ui.refreshPreviewViewport();
      return;
    }

    void this.pageManager.updateMarkdown(active.content).then(() => {
      this.documentService.updatePageCount(active.id, this.pageManager.getPageCount());
      this.ui.refreshPreviewViewport();
      this.refreshDocumentList();
      this.schedulePreviewSync(this.editor.getCurrentLineNumber(), false);
    });
  }

  private schedulePreviewSync(lineNumber: number, highlight: boolean): void {
    if (!Number.isFinite(lineNumber) || lineNumber < 1) {
      return;
    }

    if (this.previewSyncTimeout !== null) {
      window.clearTimeout(this.previewSyncTimeout);
    }

    this.previewSyncTimeout = window.setTimeout(() => {
      this.previewSyncTimeout = null;
      this.syncPreviewToSourceLine(lineNumber, highlight);
    }, 140);
  }

  private syncPreviewToSourceLine(lineNumber: number, highlight: boolean): void {
    const result = this.pageManager.getCanvasYFromSourceLine(lineNumber);
    if (!result) {
      return;
    }

    this.ui.scrollPreviewToY(result.y);
    if (highlight) {
      this.ui.highlightCanvasRegion(result.y, result.height);
    }
  }

  private async recomputeInactivePageCounts(): Promise<void> {
    const activeId = this.documentService.getActiveId();
    const allDocs = this.documentService.getAll();

    for (const doc of allDocs) {
      if (doc.id === activeId) {
        continue;
      }

      const pageCount = await this.pageManager.calculatePageCount(doc.content);
      this.documentService.updatePageCount(doc.id, pageCount);
    }

    this.refreshDocumentList();
  }

  private refreshDocumentList(): void {
    const items: DocumentListItem[] = this.documentService.toListItems().map((item) => ({
      ...item,
      pageCount: Math.max(1, item.pageCount),
    }));

    this.ui.renderDocumentList(items);
  }

  private buildExportModalContext(): ExportModalContext {
    const active = this.documentService.getActive();
    return {
      activeFilename: active?.filename ?? 'No active file',
      totalFiles: Math.max(0, this.documentService.getCount()),
      isApiAvailable: true, // Always available now
    };
  }

  private syncActiveDocumentContentFromEditor(): void {
    const active = this.documentService.getActive();
    if (!active) {
      return;
    }

    this.documentService.updateContent(active.id, this.editor.getContent());
  }

  private toPdfFilename(filename: string): string {
    return this.documentService.toPdfFilename(filename);
  }

  private async exportDocuments(scope: ExportScope): Promise<void> {
    if (this.isExporting) {
      return;
    }

    this.syncActiveDocumentContentFromEditor();

    const active = this.documentService.getActive();
    if (scope === 'current' && !active) {
      this.showError('No active markdown file to export');
      return;
    }

    const documentsToExport = scope === 'current'
      ? [active!]
      : [...this.documentService.getAll()];

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
        downloadFile(pdfBytes, filename, 'application/pdf');

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
        downloadFile(zipBlob, 'markdown-export.zip');

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

  private showError(message: string): void {
    this.ui.showNotification(message, 'error');
  }
}

// Wait for DOM to be loaded before initializing the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MD2PDFApp();
  });
} else {
  new MD2PDFApp();
}

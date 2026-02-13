import type { HeaderFooterConfig, EmojiMode } from './typesetter.js';
import { clamp } from './utils/math.js';
import { ThemeController, SidebarController, PreviewController, type FocusPreviewOptions } from './controllers/index.js';
import { HelpModal, ExportModal, HeaderFooterModal, SettingsModal, type ExportModalElements, type HeaderFooterModalElements, type SettingsModalElements, type TypographySettings } from './modals/index.js';
import { EventEmitter } from './utils/event-emitter.js';
import {
  type PageSizeKey,
  type PageSizeSpec,
  PAGE_SIZES,
  type DocumentListItem,
  type UploadedMarkdownFile,
  type SavePayload,
  type ThemeMode,
  type ExportScope,
  type ExportModalContext,
  type ExportProgressUpdate,
  type UIEvents,
} from './types/index.js';

// Re-export types for backwards compatibility
export type { PageSizeKey, PageSizeSpec, DocumentListItem, UploadedMarkdownFile, ExportModalContext, ExportProgressUpdate, ExportScope, ThemeMode };
export type { TypographySettings };

export class UIController {
  private uploadBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private exportPdfBtn: HTMLButtonElement;
  private uploadInput: HTMLInputElement;
  private fontSizeSelect: HTMLSelectElement;
  private marginSelect: HTMLSelectElement;
  private pageSizeSelect: HTMLSelectElement;
  private emojiModeSelect: HTMLSelectElement;
  private clickSyncModeSelect: HTMLSelectElement;

  private helpToggleBtn: HTMLButtonElement;
  private workspaceShell: HTMLElement;
  private readonly sidebarController: SidebarController;
  private documentList: HTMLElement;

  private mainContainer: HTMLElement;
  private paneDivider: HTMLElement;
  private markdownEditor: HTMLTextAreaElement;

  private previewContainer: HTMLElement;
  private readonly previewController: PreviewController;

  private readonly exportModal: ExportModal;
  private readonly helpModal: HelpModal;
  private readonly hfModal: HeaderFooterModal;
  private readonly settingsModal: SettingsModal;
  private headerFooterBtn: HTMLButtonElement;
  private settingsBtn: HTMLButtonElement;

  private readonly minSplitPercent = 20;
  private readonly maxSplitPercent = 80;
  private splitPercent = 50;
  private isDraggingDivider = false;

  // Event emitter for decoupled event handling
  private readonly events = new EventEmitter<UIEvents>();

  // File save callback kept separate as it returns a value (not event-compatible)
  private fileSaveCallback?: () => SavePayload;

  private readonly onDividerPointerMove = (event: PointerEvent): void => {
    if (!this.isDraggingDivider || this.isStackedLayout()) {
      return;
    }

    this.updateSplitFromPointerX(event.clientX);
    this.refreshPreviewViewport();
  };

  private readonly onDividerPointerUp = (): void => {
    if (!this.isDraggingDivider) {
      return;
    }

    this.isDraggingDivider = false;
    this.releaseDragStylesIfIdle();
  };

  constructor() {
    this.uploadBtn = this.requireElement<HTMLButtonElement>('uploadBtn');
    this.saveBtn = this.requireElement<HTMLButtonElement>('saveBtn');
    this.exportPdfBtn = this.requireElement<HTMLButtonElement>('exportPdfBtn');
    this.uploadInput = this.requireElement<HTMLInputElement>('uploadFile');
    this.fontSizeSelect = this.requireElement<HTMLSelectElement>('fontSizeSelect');
    this.marginSelect = this.requireElement<HTMLSelectElement>('marginSelect');
    this.pageSizeSelect = this.requireElement<HTMLSelectElement>('pageSizeSelect');
    this.emojiModeSelect = this.requireElement<HTMLSelectElement>('emojiModeSelect');
    this.clickSyncModeSelect = this.requireElement<HTMLSelectElement>('clickSyncModeSelect');

    // Theme controller is self-contained, no need to store reference
    new ThemeController({
      toggleBtn: this.requireElement<HTMLButtonElement>('themeToggle'),
    });
    this.helpToggleBtn = this.requireElement<HTMLButtonElement>('helpToggleBtn');
    this.workspaceShell = this.requireElement<HTMLElement>('workspaceShell');
    this.sidebarController = new SidebarController(
      {
        workspaceShell: this.workspaceShell,
        toggleBtn: this.requireElement<HTMLButtonElement>('sidebarToggleBtn'),
        toggleIcon: this.requireElement<HTMLElement>('sidebarToggleIcon'),
        divider: this.requireElement<HTMLElement>('sidebarDivider'),
      },
      {},
      {
        onViewportRefresh: () => this.refreshPreviewViewport(),
        onDragStateChange: () => this.releaseDragStylesIfIdle(),
      }
    );
    this.documentList = this.requireElement<HTMLElement>('documentList');

    this.mainContainer = this.requireElement<HTMLElement>('mainContainer');
    this.paneDivider = this.requireElement<HTMLElement>('paneDivider');
    this.markdownEditor = this.requireElement<HTMLTextAreaElement>('markdownEditor');

    this.previewContainer = this.requireElement<HTMLElement>('previewContainer');
    this.previewController = new PreviewController(
      {
        previewViewport: this.requireElement<HTMLElement>('previewViewport'),
        previewCanvasSizer: this.requireElement<HTMLElement>('previewCanvasSizer'),
        previewContainer: this.previewContainer,
        fitWidthBtn: this.requireElement<HTMLButtonElement>('fitWidthBtn'),
        fitPageBtn: this.requireElement<HTMLButtonElement>('fitPageBtn'),
        zoomInBtn: this.requireElement<HTMLButtonElement>('zoomInBtn'),
        zoomOutBtn: this.requireElement<HTMLButtonElement>('zoomOutBtn'),
        zoomReadout: this.requireElement<HTMLElement>('zoomReadout'),
      },
      {},
      {
        getPageSizeSpec: () => this.getPageSizeSpec(),
      }
    );

    const exportModalElements: ExportModalElements = {
      backdrop: this.requireElement<HTMLElement>('exportModalBackdrop'),
      closeBtn: this.requireElement<HTMLButtonElement>('exportModalCloseBtn'),
      summary: this.requireElement<HTMLElement>('exportModalSummary'),
      scopeCurrent: this.requireElement<HTMLInputElement>('exportScopeCurrent'),
      scopeAll: this.requireElement<HTMLInputElement>('exportScopeAll'),
      scopeCurrentLabel: this.requireElement<HTMLElement>('exportScopeCurrentLabel'),
      scopeAllLabel: this.requireElement<HTMLElement>('exportScopeAllLabel'),
      progressText: this.requireElement<HTMLElement>('exportProgressText'),
      progressCount: this.requireElement<HTMLElement>('exportProgressCount'),
      progressBar: this.requireElement<HTMLElement>('exportProgressBar'),
      log: this.requireElement<HTMLElement>('exportLog'),
      startBtn: this.requireElement<HTMLButtonElement>('exportStartBtn'),
      cancelBtn: this.requireElement<HTMLButtonElement>('exportCancelBtn'),
      dismissBtn: this.requireElement<HTMLButtonElement>('exportDismissBtn'),
      exportPdfBtn: this.exportPdfBtn,
    };
    this.exportModal = new ExportModal(exportModalElements);
    
    const helpTopicNavBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.help-topic-nav-btn'));
    const helpTopicPages = Array.from(document.querySelectorAll<HTMLElement>('.help-topic-page'));
    
    if (helpTopicNavBtns.length === 0 || helpTopicPages.length === 0) {
      throw new Error('Help modal requires topic navigation buttons and pages');
    }
    
    this.helpModal = new HelpModal({
      backdrop: this.requireElement<HTMLElement>('helpModalBackdrop'),
      closeBtn: this.requireElement<HTMLButtonElement>('helpModalCloseBtn'),
      body: this.requireElement<HTMLElement>('helpModalBody'),
      topicNavBtns: helpTopicNavBtns,
      topicPages: helpTopicPages,
      llmPromptCopyBtn: this.requireElement<HTMLButtonElement>('llmPromptCopyBtn'),
      llmPromptText: this.requireElement<HTMLElement>('llmPromptText'),
      llmPromptCopyStatus: this.requireElement<HTMLElement>('llmPromptCopyStatus'),
    });

    // Header/Footer modal
    this.headerFooterBtn = this.requireElement<HTMLButtonElement>('headerFooterBtn');
    const hfModalElements: HeaderFooterModalElements = {
      backdrop: this.requireElement<HTMLElement>('headerFooterModalBackdrop'),
      closeBtn: this.requireElement<HTMLButtonElement>('hfModalCloseBtn'),
      modeNone: this.requireElement<HTMLInputElement>('hfModeNone'),
      modeAuto: this.requireElement<HTMLInputElement>('hfModeAuto'),
      modeManual: this.requireElement<HTMLInputElement>('hfModeManual'),
      autoSection: this.requireElement<HTMLElement>('hfAutoSection'),
      manualSection: this.requireElement<HTMLElement>('hfManualSection'),
      autoSkipFirst: this.requireElement<HTMLInputElement>('hfAutoSkipFirst'),
      headerLeft: this.requireElement<HTMLInputElement>('hfHeaderLeft'),
      headerCenter: this.requireElement<HTMLInputElement>('hfHeaderCenter'),
      headerRight: this.requireElement<HTMLInputElement>('hfHeaderRight'),
      footerLeft: this.requireElement<HTMLInputElement>('hfFooterLeft'),
      footerCenter: this.requireElement<HTMLInputElement>('hfFooterCenter'),
      footerRight: this.requireElement<HTMLInputElement>('hfFooterRight'),
      manualSkipFirst: this.requireElement<HTMLInputElement>('hfManualSkipFirst'),
      applyBtn: this.requireElement<HTMLButtonElement>('hfApplyBtn'),
      cancelBtn: this.requireElement<HTMLButtonElement>('hfCancelBtn'),
    };
    this.hfModal = new HeaderFooterModal(hfModalElements);

    // Settings modal
    this.settingsBtn = this.requireElement<HTMLButtonElement>('settingsBtn');
    const settingsModalElements: SettingsModalElements = {
      backdrop: this.requireElement<HTMLElement>('settingsModalBackdrop'),
      closeBtn: this.requireElement<HTMLButtonElement>('settingsModalCloseBtn'),
      baseFontSize: this.requireElement<HTMLInputElement>('settingsBaseFontSize'),
      h1Scale: this.requireElement<HTMLInputElement>('settingsH1Scale'),
      h2Scale: this.requireElement<HTMLInputElement>('settingsH2Scale'),
      h3Scale: this.requireElement<HTMLInputElement>('settingsH3Scale'),
      codeFontSize: this.requireElement<HTMLInputElement>('settingsCodeFontSize'),
      tableFontSize: this.requireElement<HTMLInputElement>('settingsTableFontSize'),
      headerFooterFontSize: this.requireElement<HTMLInputElement>('settingsHFSize'),
      lineHeight: this.requireElement<HTMLInputElement>('settingsLineHeight'),
      paragraphSpacing: this.requireElement<HTMLInputElement>('settingsParagraphSpacing'),
      linkUnderline: this.requireElement<HTMLInputElement>('settingsLinkUnderline'),
      codeBlockBackground: this.requireElement<HTMLInputElement>('settingsCodeBackground'),
      codeBlockBorder: this.requireElement<HTMLInputElement>('settingsCodeBorder'),
      codeBlockLineNumbers: this.requireElement<HTMLInputElement>('settingsCodeLineNumbers'),
      applyBtn: this.requireElement<HTMLButtonElement>('settingsApplyBtn'),
      resetBtn: this.requireElement<HTMLButtonElement>('settingsResetBtn'),
      cancelBtn: this.requireElement<HTMLButtonElement>('settingsCancelBtn'),
    };
    this.settingsModal = new SettingsModal(settingsModalElements);

    this.setupEventListeners();
    this.applySettings();
    this.sidebarController.initializeWidth();
    this.setSplitPercent(this.splitPercent);
    this.refreshPreviewViewport();
  }

  /**
   * Subscribe to file upload events.
   * @returns Unsubscribe function
   */
  onFileUpload(callback: (files: UploadedMarkdownFile[]) => void): () => void {
    return this.events.on('file:upload', ({ files }) => callback(files));
  }

  /**
   * Sets the callback for file save (synchronous, returns payload).
   */
  onFileSave(callback: () => SavePayload): void {
    this.fileSaveCallback = callback;
  }

  onExportContextRequest(callback: () => ExportModalContext): void {
    this.exportModal.onContextRequest(callback);
  }

  onExportStart(callback: (scope: ExportScope) => void): void {
    this.exportModal.onStart(callback);
  }

  onExportCancel(callback: () => void): void {
    this.exportModal.onCancel(callback);
  }

  /**
   * Subscribe to document select events.
   * @returns Unsubscribe function
   */
  onDocumentSelect(callback: (documentId: string) => void): () => void {
    return this.events.on('document:select', ({ documentId }) => callback(documentId));
  }

  /**
   * Subscribe to document rename events.
   * @returns Unsubscribe function
   */
  onDocumentRename(callback: (documentId: string, nextFilename: string) => void): () => void {
    return this.events.on('document:rename', ({ documentId, nextFilename }) => callback(documentId, nextFilename));
  }

  /**
   * Subscribe to document close events.
   * @returns Unsubscribe function
   */
  onDocumentClose(callback: (documentId: string) => void): () => void {
    return this.events.on('document:close', ({ documentId }) => callback(documentId));
  }

  /**
   * Subscribe to preview source line selection events.
   * @returns Unsubscribe function
   */
  onPreviewSourceLineSelect(callback: (lineNumber: number) => void): () => void {
    return this.previewController.onPreviewSourceLineSelect(callback);
  }

  /**
   * Subscribe to settings change events.
   * @returns Unsubscribe function
   */
  onSettingsChange(callback: () => void): () => void {
    return this.events.on('settings:change', callback);
  }

  /**
   * Gets the selected page size key.
   */
  getPageSize(): PageSizeKey {
    const key = this.pageSizeSelect.value as PageSizeKey;
    if (PAGE_SIZES[key]) {
      return key;
    }

    return 'a4';
  }

  /**
   * Gets current page size dimensions.
   */
  getPageSizeSpec(): PageSizeSpec {
    return PAGE_SIZES[this.getPageSize()];
  }

  getFontSize(): number {
    return parseInt(this.fontSizeSelect.value || '12', 10);
  }

  getMargin(): number {
    return parseFloat(this.marginSelect.value || '20');
  }

  getEmojiMode(): EmojiMode {
    return this.emojiModeSelect.value === 'suppress' ? 'suppress' : 'preserve';
  }

  getClickSyncMode(): 'always' | 'ctrl' | 'off' {
    const value = this.clickSyncModeSelect.value;
    if (value === 'always' || value === 'ctrl' || value === 'off') {
      return value;
    }
    return 'ctrl';
  }

  /**
   * Gets the current typography settings from the settings modal.
   */
  getTypographySettings(): TypographySettings {
    return this.settingsModal.getSettings();
  }

  /**
   * Registers a callback for when typography settings are applied.
   */
  onTypographySettingsChange(callback: (settings: TypographySettings) => void): void {
    this.settingsModal.onApply(callback);
  }

  /**
   * Recomputes zoom/fit after pages are rendered or viewport changes.
   */
  refreshPreviewViewport(): void {
    this.previewController.refreshPreviewViewport();
  }

  /**
   * Gets the current preview zoom level.
   */
  getPreviewZoomLevel(): number {
    return this.previewController.getPreviewZoomLevel();
  }

  /**
   * Converts a zoomed canvas Y coordinate from pointer events into unscaled canvas space.
   */
  toUnscaledCanvasY(canvasY: number): number {
    return this.previewController.toUnscaledCanvasY(canvasY);
  }

  /**
   * Scrolls preview to the closest rendered block for a given markdown line.
   * Returns true when a matching block was found.
   */
  focusPreviewOnSourceLine(lineNumber: number, options: FocusPreviewOptions = {}): boolean {
    return this.previewController.focusPreviewOnSourceLine(lineNumber, options);
  }

  /**
   * Scrolls the preview viewport to a specific unscaled Y position on the canvas.
   * Used for bidirectional scroll sync with the editor.
   */
  scrollPreviewToY(canvasY: number): void {
    this.previewController.scrollPreviewToY(canvasY);
  }

  /**
   * Shows a temporary highlight overlay on the canvas at the specified position.
   * Used to indicate which block corresponds to the editor cursor.
   */
  highlightCanvasRegion(y: number, height: number): void {
    this.previewController.highlightCanvasRegion(y, height);
  }

  renderDocumentList(items: DocumentListItem[]): void {
    this.documentList.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'document-list-empty';
      empty.textContent = 'No markdown files loaded.';
      this.documentList.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'document-item-row';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'document-item';
      if (item.isActive) {
        button.classList.add('is-active');
      }
      button.dataset.documentId = item.id;
      button.title = item.filename;

      const name = document.createElement('span');
      name.className = 'document-item-name';
      name.textContent = item.filename;

      const pageCount = document.createElement('span');
      pageCount.className = 'document-item-pages';
      pageCount.textContent = `${Math.max(1, item.pageCount)}`;

      button.appendChild(name);
      button.appendChild(pageCount);

      button.addEventListener('click', () => {
        this.events.emit('document:select', { documentId: item.id });
      });

      const actions = document.createElement('div');
      actions.className = 'document-item-actions';

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'document-item-action';
      renameBtn.textContent = 'R';
      renameBtn.setAttribute('aria-label', `Rename ${item.filename}`);
      renameBtn.setAttribute('title', `Rename ${item.filename}`);
      renameBtn.addEventListener('click', () => {
        const nextFilename = window.prompt('Rename file for future downloads:', item.filename);
        if (nextFilename === null) {
          return;
        }
        this.events.emit('document:rename', { documentId: item.id, nextFilename });
      });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'document-item-action document-item-action-close';
      closeBtn.textContent = 'X';
      closeBtn.setAttribute('aria-label', `Close ${item.filename}`);
      closeBtn.setAttribute('title', `Close ${item.filename}`);
      closeBtn.addEventListener('click', () => {
        this.events.emit('document:close', { documentId: item.id });
      });

      actions.appendChild(renameBtn);
      actions.appendChild(closeBtn);
      row.appendChild(button);
      row.appendChild(actions);

      this.documentList.appendChild(row);
    });
  }

  openExportModal(context?: ExportModalContext): void {
    if (this.helpModal.getIsOpen()) {
      this.helpModal.close();
    }
    this.exportModal.openWithContext(context);
  }

  closeExportModal(): void {
    this.exportModal.close();
  }

  setExportBusy(isBusy: boolean): void {
    this.exportModal.setBusy(isBusy);
  }

  updateExportAvailability(isApiAvailable: boolean): void {
    this.exportModal.updateAvailability(isApiAvailable);
  }

  setExportProgress(update: ExportProgressUpdate): void {
    this.exportModal.setProgress(update);
  }

  setExportSummary(summary: string): void {
    this.exportModal.setSummary(summary);
  }

  clearExportLog(): void {
    this.exportModal.clearLog();
  }

  appendExportLog(message: string): void {
    this.exportModal.appendLog(message);
  }

  /**
   * Shows a toast notification.
   */
  showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 1000;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  private requireElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id) as T | null;
    if (!element) {
      throw new Error(`Required UI element with id '${id}' not found`);
    }
    return element;
  }

  private setupEventListeners(): void {
    this.uploadBtn.addEventListener('click', () => {
      this.uploadInput.click();
    });

    this.uploadInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const files = Array.from(target.files ?? []);
      if (files.length > 0) {
        void this.readFiles(files);
      }

      target.value = '';
    });

    this.saveBtn.addEventListener('click', () => {
      if (this.fileSaveCallback) {
        const payload = this.fileSaveCallback();
        this.downloadFile(payload.content, payload.filename);
      }
    });

    // Export modal event handlers are managed by ExportModal class
    // Help modal event handlers are managed by HelpModal class  
    // Header/Footer modal event handlers are managed by HeaderFooterModal class

    this.fontSizeSelect.addEventListener('change', () => {
      this.applySettings();
      this.events.emit('settings:change');
    });

    this.marginSelect.addEventListener('change', () => {
      this.applySettings();
      this.events.emit('settings:change');
    });

    this.pageSizeSelect.addEventListener('change', () => {
      this.applySettings();
      this.previewController.setZoomModeFitWidth();
      this.events.emit('settings:change');
    });

    this.emojiModeSelect.addEventListener('change', () => {
      this.applySettings();
      this.events.emit('settings:change');
    });

    this.helpToggleBtn.addEventListener('click', () => {
      this.helpModal.open();
    });

    // Header/Footer modal - event handlers managed by HeaderFooterModal class
    this.headerFooterBtn.addEventListener('click', () => {
      this.hfModal.open();
    });

    // Settings modal - event handlers managed by SettingsModal class
    this.settingsBtn.addEventListener('click', () => {
      this.settingsModal.open();
    });

    this.markdownEditor.addEventListener('scroll', () => {
      this.previewController.incrementEditorScrollRevision();
    }, { passive: true });

    this.paneDivider.addEventListener('pointerdown', (event) => {
      this.startDividerDrag(event);
    });

    this.paneDivider.addEventListener('keydown', (event) => {
      this.handleDividerKeyboard(event);
    });

    window.addEventListener('pointermove', this.onDividerPointerMove);
    window.addEventListener('pointerup', this.onDividerPointerUp);
    window.addEventListener('resize', () => {
      this.refreshPreviewViewport();
    });

    this.setupDragAndDrop();
  }

  private applySettings(): void {
    const root = document.documentElement;
    const pageSize = this.getPageSizeSpec();

    root.style.setProperty('--page-font-size', `${this.getFontSize()}px`);
    root.style.setProperty('--page-margin', `${this.getMargin()}mm`);
    root.style.setProperty('--page-width-mm', `${pageSize.widthMm}`);
    root.style.setProperty('--page-height-mm', `${pageSize.heightMm}`);
  }

  /**
   * Sets the document title for auto header/footer mode.
   */
  setDocumentTitle(title: string): void {
    this.hfModal.setDocumentTitle(title);
  }

  /**
   * Gets the current header/footer configuration.
   * Returns undefined if mode is 'none'.
   */
  getHeaderFooterConfig(): HeaderFooterConfig | undefined {
    return this.hfModal.getConfig();
  }

  /**
   * Sets the callback for header/footer changes.
   */
  onHeaderFooterChange(callback: () => void): void {
    this.hfModal.onApply(callback);
  }

  private releaseDragStylesIfIdle(): void {
    if (this.isDraggingDivider || this.sidebarController.getIsDragging()) {
      return;
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  private startDividerDrag(event: PointerEvent): void {
    if (this.isStackedLayout()) {
      return;
    }

    this.isDraggingDivider = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    this.updateSplitFromPointerX(event.clientX);
  }

  private handleDividerKeyboard(event: KeyboardEvent): void {
    if (this.isStackedLayout()) {
      return;
    }

    let handled = true;

    if (event.key === 'ArrowLeft') {
      this.setSplitPercent(this.splitPercent - 2);
    } else if (event.key === 'ArrowRight') {
      this.setSplitPercent(this.splitPercent + 2);
    } else if (event.key === 'Home') {
      this.setSplitPercent(this.minSplitPercent);
    } else if (event.key === 'End') {
      this.setSplitPercent(this.maxSplitPercent);
    } else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
      this.refreshPreviewViewport();
    }
  }

  private updateSplitFromPointerX(clientX: number): void {
    const rect = this.mainContainer.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const percent = ((clientX - rect.left) / rect.width) * 100;
    this.setSplitPercent(percent);
  }

  private setSplitPercent(percent: number): void {
    this.splitPercent = clamp(percent, this.minSplitPercent, this.maxSplitPercent);
    document.documentElement.style.setProperty('--split-ratio', `${this.splitPercent}%`);
    this.paneDivider.setAttribute('aria-valuenow', String(Math.round(this.splitPercent)));
  }

  private isStackedLayout(): boolean {
    return window.matchMedia('(max-width: 1200px)').matches;
  }

  private isMarkdownFile(file: File): boolean {
    return file.type === 'text/markdown'
      || file.type === 'text/plain'
      || file.name.toLowerCase().endsWith('.md')
      || file.name.toLowerCase().endsWith('.markdown');
  }

  private async readFiles(files: File[]): Promise<void> {
    const markdownFiles = files.filter((file) => this.isMarkdownFile(file));

    if (markdownFiles.length === 0) {
      this.showNotification('Please select markdown (.md) files', 'error');
      return;
    }

    try {
      const loadedFiles = await Promise.all(markdownFiles.map((file) => this.readSingleFile(file)));
      if (loadedFiles.length > 0) {
        this.events.emit('file:upload', { files: loadedFiles });
      }

      const message = loadedFiles.length === 1
        ? `Loaded ${loadedFiles[0].filename}`
        : `Loaded ${loadedFiles.length} markdown files`;
      this.showNotification(message, 'success');
    } catch (error) {
      console.error('File read error:', error);
      this.showNotification('Failed to read one or more files', 'error');
    }
  }

  private readSingleFile(file: File): Promise<UploadedMarkdownFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const content = String(event.target?.result ?? '');
        resolve({
          filename: file.name,
          content,
        });
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.readAsText(file);
    });
  }

  private downloadFile(content: string, filename: string): void {
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      this.showNotification(`Saved ${filename}`, 'success');
    } catch (error) {
      this.showNotification('Failed to save file', 'error');
      console.error('Save error:', error);
    }
  }

  private setupDragAndDrop(): void {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    app.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    app.addEventListener('drop', (event) => {
      event.preventDefault();

      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) {
        return;
      }

      void this.readFiles(files);
    });
  }
}

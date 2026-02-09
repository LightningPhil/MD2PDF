import { MathRenderMode } from './katex.js';

export type ZoomMode = 'fit-width' | 'fit-page' | 'manual';
export type ThemeMode = 'dark' | 'light';
export type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';
export type ExportScope = 'current' | 'all';

export interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
}

export interface UploadedMarkdownFile {
  filename: string;
  content: string;
}

export interface DocumentListItem {
  id: string;
  filename: string;
  pageCount: number;
  isActive: boolean;
}

export interface ExportModalContext {
  activeFilename: string;
  totalFiles: number;
}

export interface ExportProgressUpdate {
  processed: number;
  total: number;
  message: string;
  totalElapsedMs?: number;
  currentFileElapsedMs?: number;
}

interface SavePayload {
  content: string;
  filename: string;
}

const THEME_STORAGE_KEY = 'md2pdf.theme';

const PAGE_SIZES: Record<PageSizeKey, PageSizeSpec> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  tabloid: { widthMm: 279.4, heightMm: 431.8 },
  a3: { widthMm: 297, heightMm: 420 },
};

export class UIController {
  private uploadBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private exportPdfBtn: HTMLButtonElement;
  private mathToggleBtn: HTMLButtonElement;
  private uploadInput: HTMLInputElement;
  private fontSizeSelect: HTMLSelectElement;
  private marginSelect: HTMLSelectElement;
  private pageSizeSelect: HTMLSelectElement;

  private themeToggleBtn: HTMLButtonElement;
  private workspaceShell: HTMLElement;
  private sidebarToggleBtn: HTMLButtonElement;
  private documentList: HTMLElement;

  private mainContainer: HTMLElement;
  private paneDivider: HTMLElement;

  private previewViewport: HTMLElement;
  private previewCanvasSizer: HTMLElement;
  private previewContainer: HTMLElement;
  private fitWidthBtn: HTMLButtonElement;
  private fitPageBtn: HTMLButtonElement;
  private zoomInBtn: HTMLButtonElement;
  private zoomOutBtn: HTMLButtonElement;
  private zoomReadout: HTMLElement;

  private exportModalBackdrop: HTMLElement;
  private exportModalCloseBtn: HTMLButtonElement;
  private exportModalSummary: HTMLElement;
  private exportScopeCurrent: HTMLInputElement;
  private exportScopeAll: HTMLInputElement;
  private exportScopeCurrentLabel: HTMLElement;
  private exportScopeAllLabel: HTMLElement;
  private exportProgressText: HTMLElement;
  private exportProgressCount: HTMLElement;
  private exportProgressBar: HTMLElement;
  private exportLog: HTMLElement;
  private exportStartBtn: HTMLButtonElement;
  private exportCancelBtn: HTMLButtonElement;
  private exportDismissBtn: HTMLButtonElement;

  private currentMathMode: MathRenderMode = 'html';
  private currentTheme: ThemeMode = 'dark';
  private isSidebarCollapsed = false;

  private zoomMode: ZoomMode = 'fit-width';
  private zoomLevel = 1;

  private readonly minZoom = 0.35;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.1;
  private readonly previewSideGapPx = 24;
  private readonly previewFocusTopOffsetPx = 92;
  private readonly previewFocusSidePaddingPx = 26;
  private previewFocusTarget: HTMLElement | null = null;
  private previewFocusPage: HTMLElement | null = null;
  private previewFocusResetTimer: number | null = null;

  private readonly minSplitPercent = 20;
  private readonly maxSplitPercent = 80;
  private splitPercent = 50;
  private isDraggingDivider = false;

  private isExportModalOpen = false;
  private isExporting = false;
  private exportContext: ExportModalContext = {
    activeFilename: 'Untitled.md',
    totalFiles: 1,
  };

  // Callbacks
  private fileUploadCallback?: (files: UploadedMarkdownFile[]) => void;
  private fileSaveCallback?: () => SavePayload;
  private exportContextRequestCallback?: () => ExportModalContext;
  private exportStartCallback?: (scope: ExportScope) => void;
  private exportCancelCallback?: () => void;
  private documentSelectCallback?: (documentId: string) => void;
  private documentRenameCallback?: (documentId: string, nextFilename: string) => void;
  private documentCloseCallback?: (documentId: string) => void;
  private previewSourceLineSelectCallback?: (lineNumber: number) => void;
  private mathModeChangeCallback?: (mode: MathRenderMode) => void;
  private settingsChangeCallback?: () => void;

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
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  constructor() {
    this.uploadBtn = this.requireElement<HTMLButtonElement>('uploadBtn');
    this.saveBtn = this.requireElement<HTMLButtonElement>('saveBtn');
    this.exportPdfBtn = this.requireElement<HTMLButtonElement>('exportPdfBtn');
    this.mathToggleBtn = this.requireElement<HTMLButtonElement>('mathToggle');
    this.uploadInput = this.requireElement<HTMLInputElement>('uploadFile');
    this.fontSizeSelect = this.requireElement<HTMLSelectElement>('fontSizeSelect');
    this.marginSelect = this.requireElement<HTMLSelectElement>('marginSelect');
    this.pageSizeSelect = this.requireElement<HTMLSelectElement>('pageSizeSelect');

    this.themeToggleBtn = this.requireElement<HTMLButtonElement>('themeToggle');
    this.workspaceShell = this.requireElement<HTMLElement>('workspaceShell');
    this.sidebarToggleBtn = this.requireElement<HTMLButtonElement>('sidebarToggleBtn');
    this.documentList = this.requireElement<HTMLElement>('documentList');

    this.mainContainer = this.requireElement<HTMLElement>('mainContainer');
    this.paneDivider = this.requireElement<HTMLElement>('paneDivider');

    this.previewViewport = this.requireElement<HTMLElement>('previewViewport');
    this.previewCanvasSizer = this.requireElement<HTMLElement>('previewCanvasSizer');
    this.previewContainer = this.requireElement<HTMLElement>('previewContainer');
    this.fitWidthBtn = this.requireElement<HTMLButtonElement>('fitWidthBtn');
    this.fitPageBtn = this.requireElement<HTMLButtonElement>('fitPageBtn');
    this.zoomInBtn = this.requireElement<HTMLButtonElement>('zoomInBtn');
    this.zoomOutBtn = this.requireElement<HTMLButtonElement>('zoomOutBtn');
    this.zoomReadout = this.requireElement<HTMLElement>('zoomReadout');

    this.exportModalBackdrop = this.requireElement<HTMLElement>('exportModalBackdrop');
    this.exportModalCloseBtn = this.requireElement<HTMLButtonElement>('exportModalCloseBtn');
    this.exportModalSummary = this.requireElement<HTMLElement>('exportModalSummary');
    this.exportScopeCurrent = this.requireElement<HTMLInputElement>('exportScopeCurrent');
    this.exportScopeAll = this.requireElement<HTMLInputElement>('exportScopeAll');
    this.exportScopeCurrentLabel = this.requireElement<HTMLElement>('exportScopeCurrentLabel');
    this.exportScopeAllLabel = this.requireElement<HTMLElement>('exportScopeAllLabel');
    this.exportProgressText = this.requireElement<HTMLElement>('exportProgressText');
    this.exportProgressCount = this.requireElement<HTMLElement>('exportProgressCount');
    this.exportProgressBar = this.requireElement<HTMLElement>('exportProgressBar');
    this.exportLog = this.requireElement<HTMLElement>('exportLog');
    this.exportStartBtn = this.requireElement<HTMLButtonElement>('exportStartBtn');
    this.exportCancelBtn = this.requireElement<HTMLButtonElement>('exportCancelBtn');
    this.exportDismissBtn = this.requireElement<HTMLButtonElement>('exportDismissBtn');

    this.setupEventListeners();
    this.applySettings();
    this.initializeTheme();
    this.setSplitPercent(this.splitPercent);
    this.updateMathToggleButton();
    this.updateSidebarToggleButton();
    this.refreshPreviewViewport();
    this.resetExportPanel();
    this.applyExportContext();
  }

  /**
   * Sets the callback for file upload.
   */
  onFileUpload(callback: (files: UploadedMarkdownFile[]) => void): void {
    this.fileUploadCallback = callback;
  }

  /**
   * Sets the callback for file save.
   */
  onFileSave(callback: () => SavePayload): void {
    this.fileSaveCallback = callback;
  }

  onExportContextRequest(callback: () => ExportModalContext): void {
    this.exportContextRequestCallback = callback;
  }

  onExportStart(callback: (scope: ExportScope) => void): void {
    this.exportStartCallback = callback;
  }

  onExportCancel(callback: () => void): void {
    this.exportCancelCallback = callback;
  }

  onDocumentSelect(callback: (documentId: string) => void): void {
    this.documentSelectCallback = callback;
  }

  onDocumentRename(callback: (documentId: string, nextFilename: string) => void): void {
    this.documentRenameCallback = callback;
  }

  onDocumentClose(callback: (documentId: string) => void): void {
    this.documentCloseCallback = callback;
  }

  onPreviewSourceLineSelect(callback: (lineNumber: number) => void): void {
    this.previewSourceLineSelectCallback = callback;
  }

  /**
   * Sets the callback for math mode changes.
   */
  onMathModeChange(callback: (mode: MathRenderMode) => void): void {
    this.mathModeChangeCallback = callback;
  }

  /**
   * Sets the callback for settings changes.
   */
  onSettingsChange(callback: () => void): void {
    this.settingsChangeCallback = callback;
  }

  /**
   * Updates math mode and button label.
   */
  setMathMode(mode: MathRenderMode): void {
    this.currentMathMode = mode;
    this.updateMathToggleButton();
  }

  /**
   * Gets the current math mode.
   */
  getMathMode(): MathRenderMode {
    return this.currentMathMode;
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

  /**
   * Recomputes zoom/fit after pages are rendered or viewport changes.
   */
  refreshPreviewViewport(): void {
    if (this.zoomMode === 'fit-width') {
      this.zoomLevel = this.calculateFitWidthZoom();
    } else if (this.zoomMode === 'fit-page') {
      this.zoomLevel = this.calculateFitPageZoom();
    }

    this.applyPreviewZoom();
  }

  /**
   * Scrolls preview to the closest rendered block for a given markdown line.
   * Returns true when a matching block was found.
   */
  focusPreviewOnSourceLine(lineNumber: number): boolean {
    if (!Number.isFinite(lineNumber) || lineNumber < 1) {
      return false;
    }

    const target = this.findBestSourceLineTarget(Math.floor(lineNumber));
    if (!target) {
      return false;
    }

    this.scrollPreviewToTarget(target);
    this.highlightPreviewTarget(target);
    return true;
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
        this.documentSelectCallback?.(item.id);
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
        this.documentRenameCallback?.(item.id, nextFilename);
      });

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'document-item-action document-item-action-close';
      closeBtn.textContent = 'X';
      closeBtn.setAttribute('aria-label', `Close ${item.filename}`);
      closeBtn.setAttribute('title', `Close ${item.filename}`);
      closeBtn.addEventListener('click', () => {
        this.documentCloseCallback?.(item.id);
      });

      actions.appendChild(renameBtn);
      actions.appendChild(closeBtn);
      row.appendChild(button);
      row.appendChild(actions);

      this.documentList.appendChild(row);
    });
  }

  openExportModal(context?: ExportModalContext): void {
    if (context) {
      this.exportContext = this.normalizeExportContext(context);
    } else if (this.exportContextRequestCallback) {
      this.exportContext = this.normalizeExportContext(this.exportContextRequestCallback());
    }

    this.applyExportContext();
    if (!this.isExporting) {
      this.resetExportPanel();
    }

    this.exportModalBackdrop.hidden = false;
    document.body.classList.add('export-modal-open');
    this.isExportModalOpen = true;

    requestAnimationFrame(() => {
      if (this.isExporting) {
        this.exportCancelBtn.focus();
      } else if (!this.exportStartBtn.disabled) {
        this.exportStartBtn.focus();
      } else {
        this.exportDismissBtn.focus();
      }
    });
  }

  closeExportModal(): void {
    if (this.isExporting) {
      return;
    }

    this.exportModalBackdrop.hidden = true;
    document.body.classList.remove('export-modal-open');
    this.isExportModalOpen = false;
  }

  setExportBusy(isBusy: boolean): void {
    this.isExporting = isBusy;

    this.exportPdfBtn.disabled = isBusy;
    this.exportStartBtn.disabled = isBusy || this.exportContext.totalFiles === 0;
    this.exportCancelBtn.disabled = !isBusy;
    this.exportDismissBtn.disabled = isBusy;
    this.exportModalCloseBtn.disabled = isBusy;
    this.exportScopeCurrent.disabled = isBusy || this.exportContext.totalFiles === 0;
    this.exportScopeAll.disabled = isBusy || this.exportContext.totalFiles <= 1;

    this.exportLog.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    this.exportModalBackdrop.classList.toggle('is-exporting', isBusy);

    if (isBusy && !this.isExportModalOpen) {
      this.openExportModal(this.exportContext);
    }
  }

  setExportProgress(update: ExportProgressUpdate): void {
    const total = Math.max(0, Math.floor(update.total));
    const processed = this.clamp(Math.floor(update.processed), 0, Math.max(0, total));
    const percent = total === 0 ? 0 : Math.round((processed / total) * 100);

    this.exportProgressText.textContent = update.message;
    const timeParts: string[] = [];
    if (typeof update.currentFileElapsedMs === 'number' && Number.isFinite(update.currentFileElapsedMs)) {
      timeParts.push(`file ${this.formatDuration(update.currentFileElapsedMs)}`);
    }
    if (typeof update.totalElapsedMs === 'number' && Number.isFinite(update.totalElapsedMs)) {
      timeParts.push(`total ${this.formatDuration(update.totalElapsedMs)}`);
    }

    this.exportProgressCount.textContent = timeParts.length > 0
      ? `${processed} / ${total} | ${timeParts.join(' | ')}`
      : `${processed} / ${total}`;
    this.exportProgressBar.style.width = `${percent}%`;
    this.exportProgressBar.setAttribute('aria-valuetext', `${processed} of ${total}`);
  }

  setExportSummary(summary: string): void {
    this.exportModalSummary.textContent = summary;
  }

  clearExportLog(): void {
    this.exportLog.innerHTML = '';
  }

  appendExportLog(message: string): void {
    const nearBottom = this.exportLog.scrollHeight - this.exportLog.scrollTop - this.exportLog.clientHeight < 32;

    const line = document.createElement('div');
    line.className = 'export-log-line';

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    line.textContent = `[${hh}:${mm}:${ss}] ${message}`;
    this.exportLog.appendChild(line);

    if (nearBottom) {
      this.exportLog.scrollTop = this.exportLog.scrollHeight;
    }
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

    this.exportPdfBtn.addEventListener('click', () => {
      this.openExportModal();
    });

    this.exportStartBtn.addEventListener('click', () => {
      this.exportStartCallback?.(this.getSelectedExportScope());
    });

    this.exportCancelBtn.addEventListener('click', () => {
      this.exportCancelCallback?.();
    });

    this.exportScopeCurrent.addEventListener('change', () => {
      if (!this.isExporting) {
        this.resetExportPanel();
      }
    });

    this.exportScopeAll.addEventListener('change', () => {
      if (!this.isExporting) {
        this.resetExportPanel();
      }
    });

    this.exportDismissBtn.addEventListener('click', () => {
      this.closeExportModal();
    });

    this.exportModalCloseBtn.addEventListener('click', () => {
      this.closeExportModal();
    });

    this.exportModalBackdrop.addEventListener('click', (event) => {
      if (event.target === this.exportModalBackdrop) {
        this.closeExportModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isExportModalOpen && !this.isExporting) {
        event.preventDefault();
        this.closeExportModal();
      }
    });

    this.sidebarToggleBtn.addEventListener('click', () => {
      this.toggleSidebar();
    });

    this.mathToggleBtn.addEventListener('click', () => {
      this.toggleMathMode();
    });

    this.fontSizeSelect.addEventListener('change', () => {
      this.applySettings();
      this.settingsChangeCallback?.();
    });

    this.marginSelect.addEventListener('change', () => {
      this.applySettings();
      this.settingsChangeCallback?.();
    });

    this.pageSizeSelect.addEventListener('change', () => {
      this.applySettings();
      this.zoomMode = 'fit-width';
      this.settingsChangeCallback?.();
    });

    this.themeToggleBtn.addEventListener('click', () => {
      this.toggleTheme();
    });

    this.fitWidthBtn.addEventListener('click', () => {
      this.zoomMode = 'fit-width';
      this.refreshPreviewViewport();
    });

    this.fitPageBtn.addEventListener('click', () => {
      this.zoomMode = 'fit-page';
      this.refreshPreviewViewport();
    });

    this.zoomInBtn.addEventListener('click', () => {
      this.zoomMode = 'manual';
      this.zoomLevel = this.roundZoom(this.zoomLevel + this.zoomStep);
      this.applyPreviewZoom();
    });

    this.zoomOutBtn.addEventListener('click', () => {
      this.zoomMode = 'manual';
      this.zoomLevel = this.roundZoom(this.zoomLevel - this.zoomStep);

      const fitWidthZoom = this.calculateFitWidthZoom();
      if (this.zoomLevel <= fitWidthZoom + 0.01) {
        this.zoomMode = 'fit-width';
      }

      this.applyPreviewZoom();
    });

    this.previewViewport.addEventListener('wheel', (event) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      const magnitude = Math.max(Math.abs(event.deltaY) * 0.0012, this.zoomStep / 2);
      const direction = event.deltaY < 0 ? 1 : -1;

      this.zoomMode = 'manual';
      this.zoomLevel = this.roundZoom(this.zoomLevel + (direction * magnitude));

      const fitWidthZoom = this.calculateFitWidthZoom();
      if (this.zoomLevel <= fitWidthZoom + 0.01) {
        this.zoomMode = 'fit-width';
      }

      this.applyPreviewZoom();
    }, { passive: false });

    this.previewContainer.addEventListener('click', (event) => {
      this.handlePreviewSourceClick(event);
    });

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

  private initializeTheme(): void {
    let storedTheme: string | null = null;

    try {
      storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      storedTheme = null;
    }

    const initialTheme: ThemeMode = storedTheme === 'light' ? 'light' : 'dark';
    this.applyTheme(initialTheme);
  }

  private applyTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    document.documentElement.dataset.theme = theme;

    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${nextTheme} theme`;
    this.themeToggleBtn.setAttribute('aria-label', label);
    this.themeToggleBtn.setAttribute('title', label);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore persistence errors.
    }
  }

  private toggleTheme(): void {
    const nextTheme: ThemeMode = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  private toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.workspaceShell.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
    this.updateSidebarToggleButton();

    requestAnimationFrame(() => {
      this.refreshPreviewViewport();
    });
  }

  private updateSidebarToggleButton(): void {
    this.sidebarToggleBtn.textContent = this.isSidebarCollapsed ? '>' : '<';
    const label = this.isSidebarCollapsed ? 'Expand document list' : 'Collapse document list';
    this.sidebarToggleBtn.setAttribute('aria-label', label);
    this.sidebarToggleBtn.setAttribute('title', label);
  }

  private normalizeExportContext(context: ExportModalContext): ExportModalContext {
    const activeFilename = (context.activeFilename || 'No active file').trim() || 'No active file';
    const totalFiles = Math.max(0, Math.floor(context.totalFiles));

    return {
      activeFilename,
      totalFiles,
    };
  }

  private applyExportContext(): void {
    const totalFiles = this.exportContext.totalFiles;
    this.exportScopeCurrentLabel.textContent = `Current file (${this.exportContext.activeFilename})`;
    this.exportScopeAllLabel.textContent = `All open files (${totalFiles})`;

    const noDocuments = totalFiles === 0;
    const disableAll = totalFiles <= 1;
    this.exportScopeCurrent.disabled = noDocuments || this.isExporting;
    this.exportScopeAll.disabled = disableAll || this.isExporting;
    this.exportStartBtn.disabled = this.isExporting || noDocuments;
    if (disableAll && this.exportScopeAll.checked) {
      this.exportScopeCurrent.checked = true;
    }
  }

  private resetExportPanel(): void {
    const total = this.exportContext.totalFiles === 0
      ? 0
      : this.getSelectedExportScope() === 'all'
        ? this.exportContext.totalFiles
        : 1;
    this.setExportProgress({
      processed: 0,
      total,
      message: total === 0 ? 'No markdown files loaded' : 'Ready to export',
    });
    this.clearExportLog();
    this.setExportSummary(total === 0
      ? 'Load or create at least one markdown file before exporting.'
      : 'Choose what to export, then start. Progress updates will appear below while files are processed.');
  }

  private getSelectedExportScope(): ExportScope {
    return this.exportScopeAll.checked ? 'all' : 'current';
  }

  private handlePreviewSourceClick(event: MouseEvent): void {
    const clickedElement = this.toElement(event.target);
    if (!clickedElement) {
      return;
    }

    const anchor = this.findClickedSourceAnchor(clickedElement, event.clientY);
    if (!anchor) {
      return;
    }

    const lineNumber = this.estimateLineNumberFromAnchor(anchor, event.clientY);
    this.highlightPreviewTarget(anchor);
    this.previewSourceLineSelectCallback?.(lineNumber);
  }

  private findClickedSourceAnchor(clickedElement: HTMLElement, clickY: number): HTMLElement | null {
    const directAnchor = clickedElement.closest('.source-line-anchor') as HTMLElement | null;
    if (directAnchor) {
      return directAnchor;
    }

    const page = clickedElement.closest('.page') as HTMLElement | null;
    if (!page) {
      return null;
    }

    const anchors = Array.from(page.querySelectorAll<HTMLElement>('.source-line-anchor[data-source-line-start]'));
    if (anchors.length === 0) {
      return null;
    }

    let bestAnchor: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    anchors.forEach((anchor) => {
      const rect = anchor.getBoundingClientRect();
      const distance = clickY < rect.top
        ? rect.top - clickY
        : clickY > rect.bottom
          ? clickY - rect.bottom
          : 0;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestAnchor = anchor;
      }
    });

    return bestAnchor;
  }

  private estimateLineNumberFromAnchor(anchor: HTMLElement, clickY: number): number {
    const range = this.readSourceLineRange(anchor);
    if (!range) {
      return 1;
    }

    if (range.end <= range.start) {
      return range.start;
    }

    const rect = anchor.getBoundingClientRect();
    const height = Math.max(1, rect.height);
    const relativeY = this.clamp((clickY - rect.top) / height, 0, 0.9999);
    const span = (range.end - range.start) + 1;
    const lineOffset = Math.floor(relativeY * span);
    return range.start + lineOffset;
  }

  private toElement(target: EventTarget | null): HTMLElement | null {
    if (target instanceof HTMLElement) {
      return target;
    }

    if (target instanceof Text) {
      return target.parentElement;
    }

    return null;
  }

  private findBestSourceLineTarget(lineNumber: number): HTMLElement | null {
    const anchors = this.previewContainer.querySelectorAll<HTMLElement>('.source-line-anchor[data-source-line-start]');
    if (anchors.length === 0) {
      return null;
    }

    let bestTarget: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestRangeSize = Number.POSITIVE_INFINITY;
    let hasExactMatch = false;

    anchors.forEach((anchor) => {
      const range = this.readSourceLineRange(anchor);
      if (!range) {
        return;
      }

      const isExactMatch = lineNumber >= range.start && lineNumber <= range.end;
      const distance = isExactMatch
        ? 0
        : lineNumber < range.start
          ? range.start - lineNumber
          : lineNumber - range.end;
      const rangeSize = Math.max(0, range.end - range.start);

      if (isExactMatch && !hasExactMatch) {
        hasExactMatch = true;
        bestTarget = anchor;
        bestDistance = distance;
        bestRangeSize = rangeSize;
        return;
      }

      if (isExactMatch && hasExactMatch) {
        if (rangeSize < bestRangeSize) {
          bestTarget = anchor;
          bestRangeSize = rangeSize;
        }
        return;
      }

      if (!hasExactMatch && (distance < bestDistance || (distance === bestDistance && rangeSize < bestRangeSize))) {
        bestTarget = anchor;
        bestDistance = distance;
        bestRangeSize = rangeSize;
      }
    });

    return bestTarget;
  }

  private readSourceLineRange(element: HTMLElement): { start: number; end: number } | null {
    const start = Number.parseInt(element.dataset.sourceLineStart || '', 10);
    if (!Number.isFinite(start) || start < 1) {
      return null;
    }

    const rawEnd = Number.parseInt(element.dataset.sourceLineEnd || '', 10);
    const end = Number.isFinite(rawEnd) && rawEnd >= start ? rawEnd : start;

    return { start, end };
  }

  private scrollPreviewToTarget(target: HTMLElement): void {
    const viewportRect = this.previewViewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const desiredTop = viewportRect.top + this.previewFocusTopOffsetPx;
    const deltaY = targetRect.top - desiredTop;
    const nextTop = Math.max(0, this.previewViewport.scrollTop + deltaY);

    const leftGuide = viewportRect.left + this.previewFocusSidePaddingPx;
    const rightGuide = viewportRect.right - this.previewFocusSidePaddingPx;
    let deltaX = 0;

    if (targetRect.left < leftGuide) {
      deltaX = targetRect.left - leftGuide;
    } else if (targetRect.right > rightGuide) {
      deltaX = targetRect.right - rightGuide;
    }

    const nextLeft = Math.max(0, this.previewViewport.scrollLeft + deltaX);

    this.previewViewport.scrollTo({
      top: nextTop,
      left: nextLeft,
      behavior: 'smooth',
    });
  }

  private highlightPreviewTarget(target: HTMLElement): void {
    if (this.previewFocusTarget) {
      this.previewFocusTarget.classList.remove('preview-line-focus');
    }
    if (this.previewFocusPage) {
      this.previewFocusPage.classList.remove('preview-page-focus');
    }

    // Restart animation when selecting the same element repeatedly.
    target.classList.remove('preview-line-focus');
    void target.offsetWidth;
    target.classList.add('preview-line-focus');

    const page = target.closest('.page') as HTMLElement | null;
    if (page) {
      page.classList.remove('preview-page-focus');
      void page.offsetWidth;
      page.classList.add('preview-page-focus');
    }

    this.previewFocusTarget = target;
    this.previewFocusPage = page;

    if (this.previewFocusResetTimer !== null) {
      window.clearTimeout(this.previewFocusResetTimer);
    }

    this.previewFocusResetTimer = window.setTimeout(() => {
      if (this.previewFocusTarget) {
        this.previewFocusTarget.classList.remove('preview-line-focus');
      }
      if (this.previewFocusPage) {
        this.previewFocusPage.classList.remove('preview-page-focus');
      }
      this.previewFocusTarget = null;
      this.previewFocusPage = null;
      this.previewFocusResetTimer = null;
    }, 1800);
  }

  private getViewportPaddingPx(): { left: number; right: number; top: number; bottom: number } {
    const styles = getComputedStyle(this.previewViewport);
    return {
      left: parseFloat(styles.paddingLeft) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      top: parseFloat(styles.paddingTop) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0,
    };
  }

  private getViewportInnerSizePx(): { width: number; height: number } {
    const padding = this.getViewportPaddingPx();
    return {
      width: Math.max(this.previewViewport.clientWidth - padding.left - padding.right, 120),
      height: Math.max(this.previewViewport.clientHeight - padding.top - padding.bottom, 120),
    };
  }

  private calculateFitWidthZoom(): number {
    const pageSize = this.getBasePageSizePx();
    const viewport = this.getViewportInnerSizePx();
    const availableWidth = Math.max(viewport.width - (this.previewSideGapPx * 2), 180);
    return this.clamp(availableWidth / pageSize.width, this.minZoom, this.maxZoom);
  }

  private calculateFitPageZoom(): number {
    const pageSize = this.getBasePageSizePx();
    const viewport = this.getViewportInnerSizePx();
    const availableWidth = Math.max(viewport.width - (this.previewSideGapPx * 2), 180);
    const availableHeight = Math.max(viewport.height - 8, 180);

    const widthZoom = availableWidth / pageSize.width;
    const heightZoom = availableHeight / pageSize.height;

    return this.clamp(Math.min(widthZoom, heightZoom), this.minZoom, this.maxZoom);
  }

  private applyPreviewZoom(): void {
    this.zoomLevel = this.clamp(this.zoomLevel, this.minZoom, this.maxZoom);

    if (this.zoomMode === 'fit-width') {
      this.zoomLevel = this.calculateFitWidthZoom();
    } else if (this.zoomMode === 'fit-page') {
      this.zoomLevel = this.calculateFitPageZoom();
    }

    this.previewContainer.style.transform = `scale(${this.zoomLevel})`;

    const baseCanvas = this.getBaseCanvasSizePx();
    const scaledWidth = Math.ceil(baseCanvas.width * this.zoomLevel);
    const scaledHeight = Math.ceil(baseCanvas.height * this.zoomLevel);
    const viewport = this.getViewportInnerSizePx();

    const fitWidthZoom = this.calculateFitWidthZoom();
    const hideHorizontalOverflow = this.zoomMode !== 'manual' || this.zoomLevel <= fitWidthZoom + 0.001;

    if (hideHorizontalOverflow) {
      this.previewViewport.classList.add('no-horizontal-scroll');
      this.previewCanvasSizer.style.width = `${Math.max(viewport.width, 260)}px`;
      this.previewViewport.scrollLeft = 0;
    } else {
      this.previewViewport.classList.remove('no-horizontal-scroll');
      const minWidth = Math.max(viewport.width, 260);
      const desiredWidth = scaledWidth + (this.previewSideGapPx * 2);
      this.previewCanvasSizer.style.width = `${Math.max(desiredWidth, minWidth)}px`;
    }

    const minHeight = Math.max(viewport.height, 320);
    this.previewCanvasSizer.style.height = `${Math.max(scaledHeight + 8, minHeight)}px`;

    this.updatePreviewControlState();
  }

  private getBasePageSizePx(): { width: number; height: number } {
    const page = this.previewContainer.querySelector('.page') as HTMLElement | null;
    const selectedPage = this.getPageSizeSpec();

    if (!page) {
      return {
        width: this.mmToPx(selectedPage.widthMm),
        height: this.mmToPx(selectedPage.heightMm),
      };
    }

    const width = page.offsetWidth || this.mmToPx(selectedPage.widthMm);
    const height = page.offsetHeight || this.mmToPx(selectedPage.heightMm);

    return {
      width,
      height,
    };
  }

  private getBaseCanvasSizePx(): { width: number; height: number } {
    const pageSize = this.getBasePageSizePx();

    const width = Math.max(this.previewContainer.scrollWidth, pageSize.width);
    const height = Math.max(this.previewContainer.scrollHeight, pageSize.height);

    return {
      width,
      height,
    };
  }

  private updatePreviewControlState(): void {
    this.fitWidthBtn.classList.toggle('is-active', this.zoomMode === 'fit-width');
    this.fitPageBtn.classList.toggle('is-active', this.zoomMode === 'fit-page');

    this.zoomInBtn.disabled = this.zoomLevel >= this.maxZoom;
    this.zoomOutBtn.disabled = this.zoomLevel <= this.minZoom;

    const zoomPercent = Math.round(this.zoomLevel * 100);
    this.zoomReadout.textContent = `${zoomPercent}%`;
    this.zoomInBtn.setAttribute('title', `Zoom in (${zoomPercent}%)`);
    this.zoomOutBtn.setAttribute('title', `Zoom out (${zoomPercent}%)`);
  }

  private roundZoom(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private mmToPx(mm: number): number {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:1mm;height:0;padding:0;margin:0;border:0;';
    document.body.appendChild(probe);
    const pxPerMm = probe.getBoundingClientRect().width || (96 / 25.4);
    document.body.removeChild(probe);
    return mm * pxPerMm;
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
    this.splitPercent = this.clamp(percent, this.minSplitPercent, this.maxSplitPercent);
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
        this.fileUploadCallback?.(loadedFiles);
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

  private toggleMathMode(): void {
    const newMode: MathRenderMode = this.currentMathMode === 'html' ? 'svg' : 'html';
    this.setMathMode(newMode);

    this.mathModeChangeCallback?.(newMode);
  }

  private updateMathToggleButton(): void {
    this.mathToggleBtn.textContent = `Math: ${this.currentMathMode.toUpperCase()}`;
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

  private formatDuration(milliseconds: number): string {
    const safeMs = Math.max(0, milliseconds);
    const totalSeconds = safeMs / 1000;

    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - (minutes * 60);
    return `${minutes}m ${seconds.toFixed(1)}s`;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }
}

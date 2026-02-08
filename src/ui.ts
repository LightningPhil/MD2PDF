import { MathRenderMode } from './katex.js';

type ZoomMode = 'fit-width' | 'fit-page' | 'manual';
type ThemeMode = 'dark' | 'light';
type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';

interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
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

  private currentMathMode: MathRenderMode = 'html';
  private currentTheme: ThemeMode = 'dark';

  private zoomMode: ZoomMode = 'fit-width';
  private zoomLevel = 1;

  private readonly minZoom = 0.35;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.1;
  private readonly previewSideGapPx = 24;

  private readonly minSplitPercent = 20;
  private readonly maxSplitPercent = 80;
  private splitPercent = 50;
  private isDraggingDivider = false;

  // Callbacks
  private fileUploadCallback?: (content: string, filename: string) => void;
  private fileSaveCallback?: () => string;
  private pdfExportCallback?: () => void;
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

    this.setupEventListeners();
    this.applySettings();
    this.initializeTheme();
    this.setSplitPercent(this.splitPercent);
    this.updateMathToggleButton();
    this.refreshPreviewViewport();
  }

  /**
   * Sets the callback for file upload.
   */
  onFileUpload(callback: (content: string, filename: string) => void): void {
    this.fileUploadCallback = callback;
  }

  /**
   * Sets the callback for file save.
   */
  onFileSave(callback: () => string): void {
    this.fileSaveCallback = callback;
  }

  /**
   * Sets the callback for PDF export.
   */
  onPdfExport(callback: () => void): void {
    this.pdfExportCallback = callback;
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
      const file = target.files?.[0];
      if (file && this.fileUploadCallback) {
        this.readFile(file);
      }
    });

    this.saveBtn.addEventListener('click', () => {
      if (this.fileSaveCallback) {
        const content = this.fileSaveCallback();
        this.downloadFile(content, 'document.md');
      }
    });

    this.exportPdfBtn.addEventListener('click', () => {
      this.pdfExportCallback?.();
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

  private getFontSize(): number {
    return parseInt(this.fontSizeSelect.value || '12', 10);
  }

  private getMargin(): number {
    return parseFloat(this.marginSelect.value || '20');
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

  private readFile(file: File): void {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && this.fileUploadCallback) {
        this.fileUploadCallback(content, file.name);
        this.showNotification(`Loaded ${file.name}`, 'success');
      }
    };

    reader.onerror = () => {
      this.showNotification('Failed to read file', 'error');
    };

    reader.readAsText(file);
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

    if (this.mathModeChangeCallback) {
      this.mathModeChangeCallback(newMode);
    }
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

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.type === 'text/plain') {
        this.readFile(file);
      } else {
        this.showNotification('Please drop a markdown (.md) file', 'error');
      }
    });
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }
}

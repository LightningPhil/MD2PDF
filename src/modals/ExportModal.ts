/**
 * Export modal for PDF export functionality.
 */
import { BaseModal, type ModalElements } from './BaseModal.js';
import { clamp } from '../utils/math.js';
import { formatDuration } from '../utils/format.js';
import type { ExportModalContext, ExportProgressUpdate, ExportScope } from '../types/ui.js';

export interface ExportModalElements extends ModalElements {
  summary: HTMLElement;
  scopeCurrent: HTMLInputElement;
  scopeAll: HTMLInputElement;
  scopeCurrentLabel: HTMLElement;
  scopeAllLabel: HTMLElement;
  progressText: HTMLElement;
  progressCount: HTMLElement;
  progressBar: HTMLElement;
  log: HTMLElement;
  startBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  dismissBtn: HTMLButtonElement;
  exportPdfBtn: HTMLButtonElement;
}

export class ExportModal extends BaseModal {
  protected readonly bodyClass = 'export-modal-open';
  
  private readonly summary: HTMLElement;
  private readonly scopeCurrent: HTMLInputElement;
  private readonly scopeAll: HTMLInputElement;
  private readonly scopeCurrentLabel: HTMLElement;
  private readonly scopeAllLabel: HTMLElement;
  private readonly progressText: HTMLElement;
  private readonly progressCount: HTMLElement;
  private readonly progressBar: HTMLElement;
  private readonly log: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;
  private readonly dismissBtn: HTMLButtonElement;
  private readonly exportPdfBtn: HTMLButtonElement;

  private isExporting = false;
  private context: ExportModalContext = {
    activeFilename: 'Untitled.md',
    totalFiles: 1,
    isApiAvailable: true,
  };

  private onStartCallback?: (scope: ExportScope) => void;
  private onCancelCallback?: () => void;
  private contextRequestCallback?: () => ExportModalContext;

  constructor(elements: ExportModalElements) {
    super(elements);
    this.summary = elements.summary;
    this.scopeCurrent = elements.scopeCurrent;
    this.scopeAll = elements.scopeAll;
    this.scopeCurrentLabel = elements.scopeCurrentLabel;
    this.scopeAllLabel = elements.scopeAllLabel;
    this.progressText = elements.progressText;
    this.progressCount = elements.progressCount;
    this.progressBar = elements.progressBar;
    this.log = elements.log;
    this.startBtn = elements.startBtn;
    this.cancelBtn = elements.cancelBtn;
    this.dismissBtn = elements.dismissBtn;
    this.exportPdfBtn = elements.exportPdfBtn;
    
    this.setupListeners();
  }

  private setupListeners(): void {
    // Export PDF button opens modal
    this.exportPdfBtn.addEventListener('click', () => {
      this.open();
    });

    // Start export
    this.startBtn.addEventListener('click', () => {
      this.onStartCallback?.(this.getSelectedScope());
    });

    // Cancel export
    this.cancelBtn.addEventListener('click', () => {
      this.onCancelCallback?.();
    });

    // Scope changes
    this.scopeCurrent.addEventListener('change', () => {
      if (!this.isExporting) {
        this.resetPanel();
      }
    });

    this.scopeAll.addEventListener('change', () => {
      if (!this.isExporting) {
        this.resetPanel();
      }
    });

    // Dismiss button
    this.dismissBtn.addEventListener('click', () => {
      this.close();
    });
  }

  /**
   * Sets callback for export start.
   */
  onStart(callback: (scope: ExportScope) => void): void {
    this.onStartCallback = callback;
  }

  /**
   * Sets callback for export cancel.
   */
  onCancel(callback: () => void): void {
    this.onCancelCallback = callback;
  }

  /**
   * Sets callback to request current export context.
   */
  onContextRequest(callback: () => ExportModalContext): void {
    this.contextRequestCallback = callback;
  }

  protected onBeforeOpen(): void {
    // Request fresh context
    if (this.contextRequestCallback) {
      this.context = this.normalizeContext(this.contextRequestCallback());
    }
    
    this.applyContext();
    if (!this.isExporting) {
      this.resetPanel();
    }
  }

  protected onAfterOpen(): void {
    if (this.isExporting) {
      this.cancelBtn.focus();
    } else if (!this.startBtn.disabled) {
      this.startBtn.focus();
    } else {
      this.dismissBtn.focus();
    }
  }

  protected canClose(): boolean {
    return !this.isExporting;
  }

  /**
   * Opens modal with optional context override.
   */
  openWithContext(context?: ExportModalContext): void {
    if (context) {
      this.context = this.normalizeContext(context);
    }
    this.open();
  }

  /**
   * Sets busy state during export.
   */
  setBusy(isBusy: boolean): void {
    this.isExporting = isBusy;
    const isApiAvailable = this.context.isApiAvailable ?? true;

    this.exportPdfBtn.disabled = isBusy;
    this.startBtn.disabled = isBusy || this.context.totalFiles === 0 || !isApiAvailable;
    this.cancelBtn.disabled = !isBusy;
    this.dismissBtn.disabled = isBusy;
    this.closeBtn.disabled = isBusy;
    this.scopeCurrent.disabled = isBusy || this.context.totalFiles === 0 || !isApiAvailable;
    this.scopeAll.disabled = isBusy || this.context.totalFiles <= 1 || !isApiAvailable;

    this.log.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    this.backdrop.classList.toggle('is-exporting', isBusy);

    if (isBusy && !this.isOpen) {
      this.openWithContext(this.context);
    }
  }

  /**
   * Updates API availability state.
   */
  updateAvailability(isApiAvailable: boolean): void {
    this.context.isApiAvailable = isApiAvailable;
    
    if (this.isOpen) {
      this.applyContext();
      this.resetPanel();
    }
  }

  /**
   * Sets export progress.
   */
  setProgress(update: ExportProgressUpdate): void {
    const total = Math.max(0, Math.floor(update.total));
    const processed = clamp(Math.floor(update.processed), 0, Math.max(0, total));
    const percent = total === 0 ? 0 : Math.round((processed / total) * 100);

    this.progressText.textContent = update.message;
    const timeParts: string[] = [];
    if (typeof update.currentFileElapsedMs === 'number' && Number.isFinite(update.currentFileElapsedMs)) {
      timeParts.push(`file ${formatDuration(update.currentFileElapsedMs)}`);
    }
    if (typeof update.totalElapsedMs === 'number' && Number.isFinite(update.totalElapsedMs)) {
      timeParts.push(`total ${formatDuration(update.totalElapsedMs)}`);
    }

    this.progressCount.textContent = timeParts.length > 0
      ? `${processed} / ${total} | ${timeParts.join(' | ')}`
      : `${processed} / ${total}`;
    this.progressBar.style.width = `${percent}%`;
    this.progressBar.setAttribute('aria-valuetext', `${processed} of ${total}`);
  }

  /**
   * Sets summary text.
   */
  setSummary(summary: string): void {
    this.summary.textContent = summary;
  }

  /**
   * Clears the log.
   */
  clearLog(): void {
    this.log.innerHTML = '';
  }

  /**
   * Appends a message to the log.
   */
  appendLog(message: string): void {
    const nearBottom = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 32;

    const line = document.createElement('div');
    line.className = 'export-log-line';

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    line.textContent = `[${hh}:${mm}:${ss}] ${message}`;
    this.log.appendChild(line);

    if (nearBottom) {
      this.log.scrollTop = this.log.scrollHeight;
    }
  }

  /**
   * Gets the currently selected export scope.
   */
  getSelectedScope(): ExportScope {
    return this.scopeAll.checked ? 'all' : 'current';
  }

  /**
   * Returns whether export is currently in progress.
   */
  getIsExporting(): boolean {
    return this.isExporting;
  }

  private normalizeContext(context: ExportModalContext): ExportModalContext {
    const activeFilename = (context.activeFilename || 'No active file').trim() || 'No active file';
    const totalFiles = Math.max(0, Math.floor(context.totalFiles));
    const isApiAvailable = context.isApiAvailable !== false;

    return {
      activeFilename,
      totalFiles,
      isApiAvailable,
    };
  }

  private applyContext(): void {
    const totalFiles = this.context.totalFiles;
    const isApiAvailable = this.context.isApiAvailable ?? true;
    
    this.scopeCurrentLabel.textContent = `Current file (${this.context.activeFilename})`;
    this.scopeAllLabel.textContent = `All open files (${totalFiles})`;

    const noDocuments = totalFiles === 0;
    const disableAll = totalFiles <= 1;
    const apiUnavailable = !isApiAvailable;
    
    this.scopeCurrent.disabled = noDocuments || this.isExporting || apiUnavailable;
    this.scopeAll.disabled = disableAll || this.isExporting || apiUnavailable;
    this.startBtn.disabled = this.isExporting || noDocuments || apiUnavailable;
    
    if (disableAll && this.scopeAll.checked) {
      this.scopeCurrent.checked = true;
    }
  }

  private resetPanel(): void {
    const isApiAvailable = this.context.isApiAvailable ?? true;
    const total = this.context.totalFiles === 0
      ? 0
      : this.getSelectedScope() === 'all'
        ? this.context.totalFiles
        : 1;

    if (!isApiAvailable) {
      this.setProgress({
        processed: 0,
        total: 0,
        message: 'PDF export not available in static mode',
      });
      this.clearLog();
      this.setSummary(
        'PDF export is not available when running from static files. ' +
        'To use PDF export, run the app with "pnpm dev" or deploy with a server that supports the export API.'
      );
      return;
    }

    this.setProgress({
      processed: 0,
      total,
      message: total === 0 ? 'No markdown files loaded' : 'Ready to export',
    });
    this.clearLog();
    this.setSummary(total === 0
      ? 'Load or create at least one markdown file before exporting.'
      : 'Choose what to export, then start. Progress updates will appear below while files are processed.');
  }
}

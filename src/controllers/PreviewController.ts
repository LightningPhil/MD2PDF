/**
 * Controller for preview viewport, zoom, and source-line focus functionality.
 */
import { clamp, mmToPx } from '../utils/math.js';
import { EventEmitter } from '../utils/event-emitter.js';
import type { PageSizeSpec, ZoomMode } from '../types/index.js';

const PREVIEW_PULSE_SUPPRESSION_WINDOW_MS = 2 * 60 * 1000;

export interface PreviewPulseState {
  anchorKey: string;
  timestampMs: number;
  previewScrollRevision: number;
  editorScrollRevision: number;
}

export interface FocusPreviewOptions {
  suppressPulseIfStable?: boolean;
}

export interface PreviewControllerElements {
  previewViewport: HTMLElement;
  previewCanvasSizer: HTMLElement;
  previewContainer: HTMLElement;
  fitWidthBtn: HTMLButtonElement;
  fitPageBtn: HTMLButtonElement;
  zoomInBtn: HTMLButtonElement;
  zoomOutBtn: HTMLButtonElement;
  zoomReadout: HTMLElement;
}

export interface PreviewControllerConfig {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  previewSideGapPx?: number;
  previewFocusTopOffsetPx?: number;
  previewFocusSidePaddingPx?: number;
}

export interface PreviewControllerCallbacks {
  getPageSizeSpec: () => PageSizeSpec;
}

/**
 * Events emitted by PreviewController.
 */
export type PreviewControllerEvents = {
  'preview:line-select': { lineNumber: number };
};

export class PreviewController {
  private readonly previewViewport: HTMLElement;
  private readonly previewCanvasSizer: HTMLElement;
  private readonly previewContainer: HTMLElement;
  private readonly fitWidthBtn: HTMLButtonElement;
  private readonly fitPageBtn: HTMLButtonElement;
  private readonly zoomInBtn: HTMLButtonElement;
  private readonly zoomOutBtn: HTMLButtonElement;
  private readonly zoomReadout: HTMLElement;

  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly zoomStep: number;
  private readonly previewSideGapPx: number;
  private readonly previewFocusTopOffsetPx: number;
  private readonly previewFocusSidePaddingPx: number;

  private zoomMode: ZoomMode = 'fit-width';
  private zoomLevel = 1;

  private previewFocusTarget: HTMLElement | null = null;
  private previewFocusPage: HTMLElement | null = null;
  private previewFocusResetTimer: number | null = null;

  private canvasHighlightOverlay: HTMLElement | null = null;
  private canvasHighlightTimer: ReturnType<typeof setTimeout> | null = null;

  private recentEditorPulseState: PreviewPulseState | null = null;
  private previewScrollRevision = 0;
  private editorScrollRevision = 0;
  private ignorePreviewScrollRevisionUntilMs = 0;

  private readonly events = new EventEmitter<PreviewControllerEvents>();
  private readonly getPageSizeSpec: () => PageSizeSpec;

  constructor(
    elements: PreviewControllerElements,
    config: PreviewControllerConfig = {},
    callbacks: PreviewControllerCallbacks
  ) {
    this.previewViewport = elements.previewViewport;
    this.previewCanvasSizer = elements.previewCanvasSizer;
    this.previewContainer = elements.previewContainer;
    this.fitWidthBtn = elements.fitWidthBtn;
    this.fitPageBtn = elements.fitPageBtn;
    this.zoomInBtn = elements.zoomInBtn;
    this.zoomOutBtn = elements.zoomOutBtn;
    this.zoomReadout = elements.zoomReadout;

    this.minZoom = config.minZoom ?? 0.35;
    this.maxZoom = config.maxZoom ?? 3;
    this.zoomStep = config.zoomStep ?? 0.1;
    this.previewSideGapPx = config.previewSideGapPx ?? 24;
    this.previewFocusTopOffsetPx = config.previewFocusTopOffsetPx ?? 92;
    this.previewFocusSidePaddingPx = config.previewFocusSidePaddingPx ?? 26;

    this.getPageSizeSpec = callbacks.getPageSizeSpec;

    this.setupEventListeners();
  }

  /**
   * Subscribe to preview source line selection events.
   * @returns Unsubscribe function
   */
  onPreviewSourceLineSelect(callback: (lineNumber: number) => void): () => void {
    return this.events.on('preview:line-select', ({ lineNumber }) => callback(lineNumber));
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
   * Gets the current preview zoom level.
   */
  getPreviewZoomLevel(): number {
    return this.zoomLevel;
  }

  /**
   * Converts a zoomed canvas Y coordinate from pointer events into unscaled canvas space.
   */
  toUnscaledCanvasY(canvasY: number): number {
    const zoomLevel = this.getPreviewZoomLevel();
    if (!Number.isFinite(canvasY) || zoomLevel <= 0) {
      return 0;
    }

    return canvasY / zoomLevel;
  }

  /**
   * Scrolls preview to the closest rendered block for a given markdown line.
   * Returns true when a matching block was found.
   */
  focusPreviewOnSourceLine(lineNumber: number, options: FocusPreviewOptions = {}): boolean {
    if (!Number.isFinite(lineNumber) || lineNumber < 1) {
      return false;
    }

    const target = this.findBestSourceLineTarget(Math.floor(lineNumber));
    if (!target) {
      return false;
    }

    this.scrollPreviewToTarget(target);
    const shouldSuppressPulse = options.suppressPulseIfStable === true && this.shouldSuppressEditorPulse(target);
    if (!shouldSuppressPulse) {
      this.highlightPreviewTarget(target);
    }
    this.rememberEditorPulseState(target);
    return true;
  }

  /**
   * Scrolls the preview viewport to a specific unscaled Y position on the canvas.
   * Used for bidirectional scroll sync with the editor.
   */
  scrollPreviewToY(canvasY: number): void {
    // Convert from unscaled canvas coordinates into the viewport's scaled scroll coordinates.
    const scaledCanvasY = canvasY * this.getPreviewZoomLevel();

    // Get the canvas container's offset from the viewport's scroll origin.
    // This accounts for viewport padding.
    const containerOffsetTop = this.previewContainer.offsetTop;

    // The actual scroll position is: scaled canvas position + container offset.
    // Subtract the focus offset so the target appears near the top with some breathing room.
    const targetScrollTop = Math.max(0, containerOffsetTop + scaledCanvasY - this.previewFocusTopOffsetPx);

    this.ignorePreviewScrollRevisionUntilMs = Date.now() + 850;
    this.previewViewport.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }

  /**
   * Shows a temporary highlight overlay on the canvas at the specified position.
   * Used to indicate which block corresponds to the editor cursor.
   */
  highlightCanvasRegion(y: number, height: number): void {
    // Create overlay if it doesn't exist
    if (!this.canvasHighlightOverlay) {
      this.canvasHighlightOverlay = document.createElement('div');
      this.canvasHighlightOverlay.className = 'canvas-highlight-overlay';
      this.previewContainer.style.position = 'relative';
      this.previewContainer.appendChild(this.canvasHighlightOverlay);
    }

    // Position the overlay
    const overlay = this.canvasHighlightOverlay;
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.top = `${y}px`;
    overlay.style.height = `${Math.max(4, height)}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10';
    
    // Reset animation
    overlay.classList.remove('active');
    void overlay.offsetWidth; // Force reflow
    overlay.classList.add('active');

    // Clear previous timer
    if (this.canvasHighlightTimer) {
      clearTimeout(this.canvasHighlightTimer);
    }

    // Remove highlight after animation
    this.canvasHighlightTimer = setTimeout(() => {
      overlay.classList.remove('active');
    }, 1500);
  }

  /**
   * Sets the zoom mode to fit-width (called when page size changes).
   */
  setZoomModeFitWidth(): void {
    this.zoomMode = 'fit-width';
  }

  /**
   * Track editor scroll revision for pulse suppression.
   */
  incrementEditorScrollRevision(): void {
    this.editorScrollRevision += 1;
  }

  private setupEventListeners(): void {
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

    this.previewViewport.addEventListener('scroll', () => {
      if (Date.now() < this.ignorePreviewScrollRevisionUntilMs) {
        return;
      }
      this.previewScrollRevision += 1;
    }, { passive: true });

    this.previewContainer.addEventListener('click', (event) => {
      this.handlePreviewSourceClick(event);
    });
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
    this.events.emit('preview:line-select', { lineNumber });
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
    const relativeY = clamp((clickY - rect.top) / height, 0, 0.9999);
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

  private shouldSuppressEditorPulse(target: HTMLElement): boolean {
    const previous = this.recentEditorPulseState;
    if (!previous) {
      return false;
    }

    const now = Date.now();
    if ((now - previous.timestampMs) > PREVIEW_PULSE_SUPPRESSION_WINDOW_MS) {
      return false;
    }

    const currentAnchorKey = this.getAnchorKey(target);
    if (!currentAnchorKey || currentAnchorKey !== previous.anchorKey) {
      return false;
    }

    return previous.previewScrollRevision === this.previewScrollRevision
      && previous.editorScrollRevision === this.editorScrollRevision;
  }

  private rememberEditorPulseState(target: HTMLElement): void {
    const anchorKey = this.getAnchorKey(target);
    if (!anchorKey) {
      this.recentEditorPulseState = null;
      return;
    }

    this.recentEditorPulseState = {
      anchorKey,
      timestampMs: Date.now(),
      previewScrollRevision: this.previewScrollRevision,
      editorScrollRevision: this.editorScrollRevision,
    };
  }

  private getAnchorKey(target: HTMLElement): string | null {
    const range = this.readSourceLineRange(target);
    if (!range) {
      return null;
    }

    return `${range.start}:${range.end}`;
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

    this.ignorePreviewScrollRevisionUntilMs = Date.now() + 850;
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
    return clamp(availableWidth / pageSize.width, this.minZoom, this.maxZoom);
  }

  private calculateFitPageZoom(): number {
    const pageSize = this.getBasePageSizePx();
    const viewport = this.getViewportInnerSizePx();
    const availableWidth = Math.max(viewport.width - (this.previewSideGapPx * 2), 180);
    const availableHeight = Math.max(viewport.height - 8, 180);

    const widthZoom = availableWidth / pageSize.width;
    const heightZoom = availableHeight / pageSize.height;

    return clamp(Math.min(widthZoom, heightZoom), this.minZoom, this.maxZoom);
  }

  private applyPreviewZoom(): void {
    this.zoomLevel = clamp(this.zoomLevel, this.minZoom, this.maxZoom);

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
        width: mmToPx(selectedPage.widthMm),
        height: mmToPx(selectedPage.heightMm),
      };
    }

    const width = page.offsetWidth || mmToPx(selectedPage.widthMm);
    const height = page.offsetHeight || mmToPx(selectedPage.heightMm);

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
}

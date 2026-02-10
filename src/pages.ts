import {
  typesetMarkdown,
  renderToCanvas,
  generatePdf,
  pxToPt,
  getPageDimensionsPx,
  loadFonts,
  type PageLayout,
  type PageSizeKey,
  type HeaderFooterConfig,
  type SourceMappingEntry,
} from './typesetter.js';

const DEFAULT_MARGIN_MM = 20;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_PAGE_SIZE: PageSizeKey = 'a4';
const PAGE_GAP_PX = 40;

export interface TypesetterConfig {
  pageSize: PageSizeKey;
  marginMm: number;
  fontSizePt: number;
  headerFooter?: HeaderFooterConfig;
}

export class PageManager {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pages: PageLayout[] = [];
  private sourceMapping: SourceMappingEntry[] = [];
  private pageSize: PageSizeKey = DEFAULT_PAGE_SIZE;
  private marginMm: number = DEFAULT_MARGIN_MM;
  private fontSizePx: number = DEFAULT_FONT_SIZE_PX;
  private currentMarkdown: string = '';
  private isInitialized: boolean = false;
  private pendingRender: boolean = false;
  private zoom: number = 1;
  private headerFooter: HeaderFooterConfig | undefined = undefined;
  private documentTitle: string = 'Untitled';
  private renderRevision: number = 0;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = container;

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'preview-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    // No background color - let preview-pane's gray show through gaps
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // Initialize fonts in background
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await loadFonts();
      this.isInitialized = true;
      if (this.pendingRender) {
        this.pendingRender = false;
        await this.render();
      }
    } catch (error) {
      console.error('Failed to initialize typesetter fonts:', error);
    }
  }

  /**
   * Updates the preview with new markdown content.
   */
  async updateMarkdown(markdown: string): Promise<void> {
    this.currentMarkdown = markdown;

    if (!this.isInitialized) {
      this.pendingRender = true;
      return;
    }

    await this.render();
  }

  /**
   * Sets the page size.
   */
  setPageSize(size: PageSizeKey): void {
    if (this.pageSize !== size) {
      this.pageSize = size;
      void this.render();
    }
  }

  /**
   * Sets the margin in mm.
   */
  setMargin(marginMm: number): void {
    if (this.marginMm !== marginMm) {
      this.marginMm = marginMm;
      void this.render();
    }
  }

  /**
   * Sets the font size in px (will be converted to pt).
   */
  setFontSize(fontSizePx: number): void {
    if (this.fontSizePx !== fontSizePx) {
      this.fontSizePx = fontSizePx;
      void this.render();
    }
  }

  /**
   * Sets the zoom level for rendering.
   */
  setZoom(zoom: number): void {
    if (this.zoom !== zoom) {
      this.zoom = zoom;
      void this.renderCanvas();
    }
  }

  /**
   * Gets the current zoom level.
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Gets the number of pages.
   */
  getPageCount(): number {
    return Math.max(1, this.pages.length);
  }

  /**
   * Gets the current pages.
   */
  getPages(): PageLayout[] {
    return this.pages;
  }

  /**
   * Gets the canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Calculates page count for given markdown without updating preview.
   */
  async calculatePageCount(markdown: string): Promise<number> {
    if (!this.isInitialized) {
      return 1;
    }

    try {
      const config = this.getConfig();
      const result = await typesetMarkdown(markdown, config);
      return Math.max(1, result.pages.length);
    } catch (error) {
      console.error('Failed to calculate page count:', error);
      return 1;
    }
  }

  /**
   * Generates a PDF from the current pages.
   */
  async exportPdf(title?: string): Promise<Uint8Array> {
    const config = this.getConfig();
    return generatePdf(this.pages, config, { title });
  }

  /**
   * Gets the page dimensions in pixels at current zoom.
   */
  getPageDimensions(): { widthPx: number; heightPx: number } {
    const base = getPageDimensionsPx(this.pageSize);
    return {
      widthPx: base.widthPx * this.zoom,
      heightPx: base.heightPx * this.zoom,
    };
  }

  /**
   * Gets the total canvas height (all pages stacked).
   */
  getTotalHeight(): number {
    const pageDims = this.getPageDimensions();
    const pageCount = this.getPageCount();
    return pageCount * pageDims.heightPx + (pageCount - 1) * PAGE_GAP_PX * this.zoom;
  }

  private getConfig(): TypesetterConfig {
    return {
      pageSize: this.pageSize,
      marginMm: this.marginMm,
      fontSizePt: pxToPt(this.fontSizePx),
      headerFooter: this.headerFooter,
    };
  }

  /**
   * Sets the document title (used for auto header/footer).
   */
  setDocumentTitle(title: string): void {
    this.documentTitle = title;
  }

  /**
   * Gets the document title.
   */
  getDocumentTitle(): string {
    return this.documentTitle;
  }

  /**
   * Sets the header/footer configuration.
   */
  setHeaderFooter(config: HeaderFooterConfig | undefined): void {
    this.headerFooter = config;
    void this.render();
  }

  /**
   * Gets the current header/footer configuration.
   */
  getHeaderFooter(): HeaderFooterConfig | undefined {
    return this.headerFooter;
  }

  private async render(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const renderRevision = ++this.renderRevision;
    const markdown = this.currentMarkdown;
    if (!markdown.trim()) {
      if (renderRevision !== this.renderRevision) {
        return;
      }
      this.pages = [];
      this.sourceMapping = [];
      await this.renderCanvas(renderRevision);
      return;
    }

    try {
      const config = this.getConfig();
      const result = await typesetMarkdown(markdown, config);
      if (renderRevision !== this.renderRevision) {
        return;
      }
      this.pages = result.pages;
      this.sourceMapping = result.sourceMapping ?? [];

      if (result.diagnostics.errors.length > 0) {
        console.warn('Typeset errors:', result.diagnostics.errors);
      }

      await this.renderCanvas(renderRevision);
    } catch (error) {
      console.error('Failed to typeset markdown:', error);
    }
  }

  private async renderCanvas(expectedRevision: number = this.renderRevision): Promise<void> {
    if (!this.isInitialized || expectedRevision !== this.renderRevision) {
      return;
    }

    // Handle empty state
    if (this.pages.length === 0) {
      const pageDims = getPageDimensionsPx(this.pageSize);
      this.canvas.width = pageDims.widthPx * this.zoom * window.devicePixelRatio;
      this.canvas.height = pageDims.heightPx * this.zoom * window.devicePixelRatio;
      this.canvas.style.width = `${pageDims.widthPx * this.zoom}px`;
      this.canvas.style.height = `${pageDims.heightPx * this.zoom}px`;

      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, pageDims.widthPx * this.zoom, pageDims.heightPx * this.zoom);
        ctx.fillStyle = '#999';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Preview will appear here...', pageDims.widthPx * this.zoom / 2, pageDims.heightPx * this.zoom / 2);
      }
      return;
    }

    try {
      const config = this.getConfig();
      await renderToCanvas(this.pages, this.canvas, config, {
        zoom: this.zoom,
        pageGapPt: PAGE_GAP_PX * 72 / 96, // Convert px to pt
        background: 'white',
        mode: 'stackedPages',
      });
      if (expectedRevision !== this.renderRevision) {
        return;
      }

      // Update canvas display size
      const pageDims = getPageDimensionsPx(this.pageSize);
      this.canvas.style.width = `${pageDims.widthPx * this.zoom}px`;
    } catch (error) {
      console.error('Failed to render canvas:', error);
    }
  }

  /**
   * Convert an unscaled canvas Y position (in CSS pixels at 100% zoom) to a source line number.
   * Returns null if no mapping is found.
   */
  getSourceLineFromCanvasY(canvasY: number): number | null {
    if (!Number.isFinite(canvasY) || this.sourceMapping.length === 0 || this.pages.length === 0) {
      return null;
    }

    // Convert unscaled canvas Y (in CSS pixels) to points.
    const ptPerPx = 72 / 96;
    const pageGapPt = PAGE_GAP_PX * ptPerPx;
    const yPt = Math.max(0, canvasY) * ptPerPx;

    // Find which page and y-position this corresponds to
    let cumulativeYPt = 0;
    let targetPageIndex = 0;
    let yOnPagePt = yPt;

    for (let i = 0; i < this.pages.length; i++) {
      const pageHeightPt = this.pages[i].heightPt;
      const pageEndPt = cumulativeYPt + pageHeightPt;
      
      if (yPt <= pageEndPt) {
        targetPageIndex = i;
        yOnPagePt = yPt - cumulativeYPt;
        break;
      }
      
      cumulativeYPt = pageEndPt + pageGapPt;
      targetPageIndex = i + 1;
    }

    // Handle click beyond last page
    if (targetPageIndex >= this.pages.length) {
      targetPageIndex = this.pages.length - 1;
      yOnPagePt = this.pages[targetPageIndex].heightPt;
    }

    // Find the best matching source mapping entry
    let bestEntry: SourceMappingEntry | null = null;
    let bestDistance = Infinity;

    for (const entry of this.sourceMapping) {
      if (entry.pageIndex === targetPageIndex) {
        // Check if click is within this block's y-range.
        if (yOnPagePt >= entry.yStartPt && yOnPagePt <= entry.yEndPt) {
          return this.estimateSourceLineForEntryAtY(entry, yOnPagePt);
        }

        // Track closest block.
        const distance = yOnPagePt < entry.yStartPt
          ? entry.yStartPt - yOnPagePt
          : yOnPagePt - entry.yEndPt;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestEntry = entry;
        }
      }
    }

    if (!bestEntry) {
      return null;
    }

    return this.estimateSourceLineForEntryAtY(bestEntry, yOnPagePt);
  }

  /**
   * Convert a source line number to an unscaled canvas Y position (in CSS pixels at 100% zoom).
   * Returns null if no mapping is found.
   */
  getCanvasYFromSourceLine(lineNumber: number): { y: number; height: number } | null {
    if (!Number.isFinite(lineNumber) || this.sourceMapping.length === 0 || this.pages.length === 0) {
      return null;
    }

    // Find the mapping entry that contains this line
    let bestEntry: SourceMappingEntry | null = null;
    let bestDistance = Infinity;

    for (const entry of this.sourceMapping) {
      if (lineNumber >= entry.sourceLineStart && lineNumber <= entry.sourceLineEnd) {
        bestEntry = entry;
        break;
      }

      // Track closest if no exact match
      const distance = lineNumber < entry.sourceLineStart
        ? entry.sourceLineStart - lineNumber
        : lineNumber - entry.sourceLineEnd;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEntry = entry;
      }
    }

    if (!bestEntry) {
      return null;
    }

    // Calculate the Y position in canvas coordinates
    const ptPerPx = 72 / 96;
    const pageGapPt = PAGE_GAP_PX * ptPerPx;

    // Get cumulative Y to the start of the target page
    let cumulativeYPt = 0;
    for (let i = 0; i < bestEntry.pageIndex && i < this.pages.length; i++) {
      cumulativeYPt += this.pages[i].heightPt + pageGapPt;
    }

    const entryCanvasPosition = this.getEntryCanvasPositionForLine(bestEntry, lineNumber);
    const yPt = cumulativeYPt + entryCanvasPosition.yPt;

    // Convert to unscaled CSS pixels.
    return {
      y: yPt / ptPerPx,
      height: entryCanvasPosition.heightPt / ptPerPx,
    };
  }

  /**
   * Get the source mapping for debugging.
   */
  getSourceMapping(): SourceMappingEntry[] {
    return this.sourceMapping;
  }

  private estimateSourceLineForEntryAtY(entry: SourceMappingEntry, yOnPagePt: number): number {
    const startLine = entry.sourceLineStart;
    const endLine = Math.max(startLine, entry.sourceLineEnd);
    if (endLine === startLine) {
      return startLine;
    }

    const heightPt = entry.yEndPt - entry.yStartPt;
    if (heightPt <= 0) {
      return startLine;
    }

    const clampedY = this.clamp(yOnPagePt, entry.yStartPt, entry.yEndPt);
    const normalizedY = (clampedY - entry.yStartPt) / heightPt;
    const lineCount = (endLine - startLine) + 1;
    const lineOffset = Math.min(lineCount - 1, Math.floor(normalizedY * lineCount));
    return startLine + lineOffset;
  }

  private getEntryCanvasPositionForLine(
    entry: SourceMappingEntry,
    lineNumber: number,
  ): { yPt: number; heightPt: number } {
    const startLine = entry.sourceLineStart;
    const endLine = Math.max(startLine, entry.sourceLineEnd);
    const blockHeightPt = Math.max(1, entry.yEndPt - entry.yStartPt);

    if (endLine === startLine) {
      return {
        yPt: entry.yStartPt,
        heightPt: blockHeightPt,
      };
    }

    const clampedLine = this.clamp(Math.floor(lineNumber), startLine, endLine);
    const normalizedLine = (clampedLine - startLine) / (endLine - startLine);
    return {
      yPt: entry.yStartPt + (blockHeightPt * normalizedLine),
      heightPt: Math.max(1, blockHeightPt / ((endLine - startLine) + 1)),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

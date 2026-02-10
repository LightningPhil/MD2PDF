import {
  typesetMarkdown,
  renderToCanvas,
  generatePdf,
  pxToPt,
  getPageDimensionsPx,
  loadFonts,
  type PageLayout,
  type PageSizeKey,
} from './typesetter.js';

const DEFAULT_MARGIN_MM = 20;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_PAGE_SIZE: PageSizeKey = 'a4';
const PAGE_GAP_PX = 24;

export interface TypesetterConfig {
  pageSize: PageSizeKey;
  marginMm: number;
  fontSizePt: number;
}

export class PageManager {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pages: PageLayout[] = [];
  private pageSize: PageSizeKey = DEFAULT_PAGE_SIZE;
  private marginMm: number = DEFAULT_MARGIN_MM;
  private fontSizePx: number = DEFAULT_FONT_SIZE_PX;
  private currentMarkdown: string = '';
  private isInitialized: boolean = false;
  private pendingRender: boolean = false;
  private zoom: number = 1;

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
    this.canvas.style.backgroundColor = '#fff';
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
    };
  }

  private async render(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const markdown = this.currentMarkdown.trim();
    if (!markdown) {
      this.pages = [];
      this.renderCanvas();
      return;
    }

    try {
      const config = this.getConfig();
      const result = await typesetMarkdown(markdown, config);
      this.pages = result.pages;

      if (result.diagnostics.errors.length > 0) {
        console.warn('Typeset errors:', result.diagnostics.errors);
      }

      this.renderCanvas();
    } catch (error) {
      console.error('Failed to typeset markdown:', error);
    }
  }

  private async renderCanvas(): Promise<void> {
    if (!this.isInitialized) {
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

      // Update canvas display size
      const pageDims = getPageDimensionsPx(this.pageSize);
      this.canvas.style.width = `${pageDims.widthPx * this.zoom}px`;
    } catch (error) {
      console.error('Failed to render canvas:', error);
    }
  }

}

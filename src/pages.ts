import { paginate } from './paginator.js';
import { renderMath, MathRenderMode } from './katex.js';
import { DEFAULT_SETTINGS, type DocumentSettings } from './document.js';

const DEFAULT_PAGE_HEIGHT_MM = 297;
const DEFAULT_MARGIN_MM = 20;
const FALLBACK_PX_PER_MM = 96 / 25.4;

export class PageManager {
  private container: HTMLElement;
  private pages: HTMLElement[] = [];
  private mathMode: MathRenderMode = 'html';
  private settings: DocumentSettings = { ...DEFAULT_SETTINGS };
  
  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = container;
  }
  
  /**
   * Updates the pages with new content
   * @param content - The HTML content to display
   */
  updatePages(content: HTMLElement): void {
    // Clear existing pages
    this.clearPages();

    // Create pages using the paginator
    this.pages = this.paginateContent(content);
    
    // Add pages to container
    this.displayPages();
  }
  
  /**
   * Sets the math rendering mode
   * @param mode - The math rendering mode ('html' or 'svg')
   */
  setMathMode(mode: MathRenderMode): void {
    this.mathMode = mode;
  }
  
  /**
   * Gets the current math rendering mode
   */
  getMathMode(): MathRenderMode {
    return this.mathMode;
  }

  setSettings(settings: DocumentSettings): void { this.settings = settings; }
  
  /**
   * Gets the number of pages
   */
  getPageCount(): number {
    return this.pages.length;
  }

  /**
   * Calculates page count without mutating current preview state.
   */
  calculatePageCount(content: HTMLElement): number {
    const paginated = this.paginateContent(content);
    return Math.max(1, paginated.length);
  }
  
  /**
   * Clears all pages from the container
   */
  private clearPages(): void {
    this.container.innerHTML = '';
    this.pages = [];
  }
  
  /**
   * Displays all pages in the container
   */
  private displayPages(): void {
    this.pages.forEach((pageContent, index) => {
      // Create page wrapper
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page';
      pageWrapper.appendChild(pageContent);
      
      // Add page number (optional)
      const pageNumber = document.createElement('div');
      pageNumber.className = 'page-number';
      pageNumber.textContent = this.settings.pageNumbers === 'total' ? `Page ${index + 1} of ${this.pages.length}` : `${index + 1}`;
      pageNumber.style.cssText = `
        position: absolute;
        bottom: 10mm;
        right: 10mm;
        font-size: 10px;
        color: #666;
        font-family: Arial, sans-serif;
      `;
      if (this.settings.pageNumbers !== 'none') pageWrapper.appendChild(pageNumber);
      for (const kind of ['header', 'footer'] as const) {
        if (!this.settings[kind]) continue;
        const runningText = document.createElement('div');
        runningText.className = `document-${kind}`;
        runningText.textContent = this.settings[kind].replace(/\{page\}/g, String(index + 1)).replace(/\{pages\}/g, String(this.pages.length));
        pageWrapper.append(runningText);
      }
      
      this.container.appendChild(pageWrapper);
    });
    const seenIds = new Set<string>();
    this.container.querySelectorAll<HTMLElement>('[id]').forEach(element => {
      if (seenIds.has(element.id)) element.removeAttribute('id');
      else seenIds.add(element.id);
    });
    const pageElements = Array.from(this.container.querySelectorAll<HTMLElement>('.page'));
    this.container.querySelectorAll<HTMLAnchorElement>('.document-toc a').forEach(link => {
      const destination = Array.from(this.container.querySelectorAll<HTMLElement>('[id]')).find(element => element.id === link.hash.slice(1));
      const page = destination?.closest<HTMLElement>('.page');
      if (page) {
        const number = document.createElement('span'); number.className = 'toc-page-number'; number.textContent = String(pageElements.indexOf(page) + 1); link.append(number);
      }
    });
    
    // If no pages, show placeholder
    if (this.pages.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'page';
      placeholder.innerHTML = `
        <div class="page-content">
          <p style="text-align: center; color: #999; margin-top: 50px;">
            Preview will appear here...
          </p>
        </div>
      `;
      this.container.appendChild(placeholder);
    }
  }

  /**
   * Paginates content using current page settings and math mode.
   */
  private paginateContent(content: HTMLElement): HTMLElement[] {
    // Calculate available content height from current margin settings.
    const pageHeightPx = this.getPageContentHeightPx();

    // Render math before pagination so block heights are measured correctly.
    const paginableContent = content.cloneNode(true) as HTMLElement;
    renderMath(paginableContent, this.mathMode);

    return paginate(paginableContent, pageHeightPx);
  }

  /**
   * Calculates usable content height for an A4 page based on current margin.
   */
  private getPageContentHeightPx(): number {
    const pageHeightMm = this.getPageHeightMm();
    const marginMm = this.getPageMarginMm();
    const contentHeightMm = Math.max(pageHeightMm - (marginMm * 2), 40);
    return this.mmToPx(contentHeightMm);
  }

  private getPageHeightMm(): number {
    const rootStyles = getComputedStyle(document.documentElement);
    const pageHeightValue = rootStyles.getPropertyValue('--page-height-mm').trim();
    const pageHeightMm = parseFloat(pageHeightValue);
    return Number.isFinite(pageHeightMm) ? pageHeightMm : DEFAULT_PAGE_HEIGHT_MM;
  }

  private getPageMarginMm(): number {
    const rootStyles = getComputedStyle(document.documentElement);
    const marginValue = rootStyles.getPropertyValue('--page-margin').trim();
    const marginMm = parseFloat(marginValue);
    return Number.isFinite(marginMm) ? marginMm : DEFAULT_MARGIN_MM;
  }

  private mmToPx(mm: number): number {
    const probe = document.createElement('div');
    probe.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: 1mm;
      height: 0;
      padding: 0;
      margin: 0;
      border: 0;
    `;
    document.body.appendChild(probe);
    const pxPerMm = probe.getBoundingClientRect().width || FALLBACK_PX_PER_MM;
    document.body.removeChild(probe);
    return mm * pxPerMm;
  }
}

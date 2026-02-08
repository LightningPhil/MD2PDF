import { paginate } from './paginator.js';
import { renderMath, MathRenderMode } from './katex.js';

const DEFAULT_PAGE_HEIGHT_MM = 297;
const DEFAULT_MARGIN_MM = 20;
const FALLBACK_PX_PER_MM = 96 / 25.4;

export class PageManager {
  private container: HTMLElement;
  private pages: HTMLElement[] = [];
  private mathMode: MathRenderMode = 'html';
  
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

    // Calculate available content height from current margin settings.
    const pageHeightPx = this.getPageContentHeightPx();

    // Render math before pagination so block heights are measured correctly.
    const paginableContent = content.cloneNode(true) as HTMLElement;
    renderMath(paginableContent, this.mathMode);

    // Create pages using the paginator
    this.pages = paginate(paginableContent, pageHeightPx);
    
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
  
  /**
   * Gets the number of pages
   */
  getPageCount(): number {
    return this.pages.length;
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
      pageNumber.textContent = `${index + 1}`;
      pageNumber.style.cssText = `
        position: absolute;
        bottom: 10mm;
        right: 10mm;
        font-size: 10px;
        color: #666;
        font-family: Arial, sans-serif;
      `;
      pageWrapper.appendChild(pageNumber);
      
      this.container.appendChild(pageWrapper);
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

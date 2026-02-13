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
  type EmojiMode,
  type SourceMappingEntry,
} from './typesetter.js';
import { clamp } from './utils/math.js';

const DEFAULT_MARGIN_MM = 20;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_PAGE_SIZE: PageSizeKey = 'a4';
const PAGE_GAP_PX = 40;

export interface TypographyConfig {
  baseFontSizePt?: number;
  h1Scale?: number;
  h2Scale?: number;
  h3Scale?: number;
  lineHeight?: number;
  paragraphSpacingPt?: number;
  codeFontSizePt?: number;
  tableFontSizePt?: number;
  headerFooterFontSizePt?: number;
  linkUnderline?: boolean;
  codeBlockBackground?: boolean;
  codeBlockBorder?: boolean;
  codeBlockLineNumbers?: boolean;
}

export interface TypesetterConfig {
  pageSize: PageSizeKey;
  marginMm: number;
  fontSizePt: number;
  headerFooter?: HeaderFooterConfig;
  emojiMode?: EmojiMode;
  typography?: TypographyConfig;
}

interface SourceLineBox {
  lineNumber: number;
  documentStartPt: number;
  documentEndPt: number;
  centerPt: number;
  heightPt: number;
  sourceSpanLines: number;
}

interface SourceLineCandidate {
  documentStartPt: number;
  documentEndPt: number;
  spanLines: number;
  sourceLineStart: number;
  sourceLineEnd: number;
}

export class PageManager {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pages: PageLayout[] = [];
  private sourceMapping: SourceMappingEntry[] = [];
  private sourceLineBoxes: SourceLineBox[] = [];
  private sourceLineBoxByLine = new Map<number, SourceLineBox>();
  private pageSize: PageSizeKey = DEFAULT_PAGE_SIZE;
  private marginMm: number = DEFAULT_MARGIN_MM;
  private fontSizePx: number = DEFAULT_FONT_SIZE_PX;
  private currentMarkdown: string = '';
  private isInitialized: boolean = false;
  private pendingRender: boolean = false;
  private zoom: number = 1;
  private headerFooter: HeaderFooterConfig | undefined = undefined;
  private emojiMode: EmojiMode = 'preserve';
  private typographyConfig: TypographyConfig | undefined = undefined;
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
    return generatePdf(this.pages, config, {
      title,
      fontSubsetting: true,
    });
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
      emojiMode: this.emojiMode,
      typography: this.typographyConfig,
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

  /**
   * Sets emoji handling mode for layout/rendering.
   */
  setEmojiMode(mode: EmojiMode): void {
    if (this.emojiMode !== mode) {
      this.emojiMode = mode;
      void this.render();
    }
  }

  /**
   * Gets current emoji handling mode.
   */
  getEmojiMode(): EmojiMode {
    return this.emojiMode;
  }

  /**
   * Sets typography configuration (heading scales, line height, etc.).
   */
  setTypographySettings(config: TypographyConfig | undefined): void {
    this.typographyConfig = config;
    void this.render();
  }

  /**
   * Gets current typography configuration.
   */
  getTypographySettings(): TypographyConfig | undefined {
    return this.typographyConfig;
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
      this.sourceLineBoxes = [];
      this.sourceLineBoxByLine.clear();
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
      this.rebuildSourceLineBoxes();

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
    if (!Number.isFinite(canvasY) || this.pages.length === 0 || this.sourceLineBoxes.length === 0) {
      return null;
    }

    const locatedPosition = this.locateCanvasPosition(canvasY);
    if (!locatedPosition) {
      return null;
    }
    const { pageIndex, yOnPagePt } = locatedPosition;
    const documentYPt = this.getPageDocumentOffsetPt(pageIndex) + yOnPagePt;
    return this.findNearestLineBoxByDocumentY(documentYPt)?.lineNumber ?? null;
  }

  /**
   * Convert a source line number to an unscaled canvas Y position (in CSS pixels at 100% zoom).
   * Returns null if no mapping is found.
   */
  getCanvasYFromSourceLine(lineNumber: number): { y: number; height: number } | null {
    if (!Number.isFinite(lineNumber) || this.pages.length === 0 || this.sourceLineBoxes.length === 0) {
      return null;
    }

    const ptPerPx = 72 / 96;
    const lineBox = this.resolveLineBox(Math.max(1, Math.floor(lineNumber)));
    if (!lineBox) {
      return null;
    }

    return {
      y: lineBox.documentStartPt / ptPerPx,
      height: Math.max(1, lineBox.heightPt) / ptPerPx,
    };
  }

  /**
   * Get the source mapping for debugging.
   */
  getSourceMapping(): SourceMappingEntry[] {
    return this.sourceMapping;
  }

  private rebuildSourceLineBoxes(): void {
    this.sourceLineBoxes = [];
    this.sourceLineBoxByLine.clear();

    if (this.sourceMapping.length === 0 || this.pages.length === 0) {
      return;
    }

    const sourceLineCount = this.getSourceLineCount();
    if (!Number.isFinite(sourceLineCount) || sourceLineCount < 1) {
      return;
    }

    const pageOffsetsPt = this.getPageOffsetsPt();
    const totalDocumentHeightPt = Math.max(
      1,
      (pageOffsetsPt[this.pages.length - 1] ?? 0) + Math.max(1, this.pages[this.pages.length - 1]?.heightPt ?? 1),
    );

    const candidatesByLine = this.collectSourceLineCandidates(sourceLineCount, pageOffsetsPt);
    const selectedByLine: Array<SourceLineCandidate | null> = new Array(sourceLineCount + 1).fill(null);
    const rawCentersPt: number[] = new Array(sourceLineCount + 1).fill(0);
    const rawHeightsPt: number[] = new Array(sourceLineCount + 1).fill(12);
    const rawSpanLines: number[] = new Array(sourceLineCount + 1).fill(Number.POSITIVE_INFINITY);
    const mappedLines: number[] = [];

    for (let lineNumber = 1; lineNumber <= sourceLineCount; lineNumber += 1) {
      const selected = this.selectBestCandidate(candidatesByLine[lineNumber], lineNumber);
      if (!selected) {
        continue;
      }

      selectedByLine[lineNumber] = selected;
      mappedLines.push(lineNumber);
      rawCentersPt[lineNumber] = (selected.documentStartPt + selected.documentEndPt) * 0.5;
      rawHeightsPt[lineNumber] = Math.max(0.25, selected.documentEndPt - selected.documentStartPt);
      rawSpanLines[lineNumber] = selected.spanLines;
    }

    const defaultHeightPt = Math.max(0.25, this.getMedian(mappedLines.map((line) => rawHeightsPt[line])) ?? 12);

    const previousMappedLine: number[] = new Array(sourceLineCount + 1).fill(0);
    const nextMappedLine: number[] = new Array(sourceLineCount + 2).fill(0);

    let previousMapped = 0;
    for (let lineNumber = 1; lineNumber <= sourceLineCount; lineNumber += 1) {
      if (selectedByLine[lineNumber]) {
        previousMapped = lineNumber;
      }
      previousMappedLine[lineNumber] = previousMapped;
    }

    let nextMapped = 0;
    for (let lineNumber = sourceLineCount; lineNumber >= 1; lineNumber -= 1) {
      if (selectedByLine[lineNumber]) {
        nextMapped = lineNumber;
      }
      nextMappedLine[lineNumber] = nextMapped;
    }

    for (let lineNumber = 1; lineNumber <= sourceLineCount; lineNumber += 1) {
      if (selectedByLine[lineNumber]) {
        continue;
      }

      const previousLine = previousMappedLine[lineNumber];
      const nextLine = nextMappedLine[lineNumber];

      if (previousLine > 0 && nextLine > 0 && previousLine !== nextLine) {
        const ratio = (lineNumber - previousLine) / (nextLine - previousLine);
        rawCentersPt[lineNumber] = rawCentersPt[previousLine] + (rawCentersPt[nextLine] - rawCentersPt[previousLine]) * ratio;
        rawHeightsPt[lineNumber] = rawHeightsPt[previousLine] + (rawHeightsPt[nextLine] - rawHeightsPt[previousLine]) * ratio;
        rawSpanLines[lineNumber] = Math.max(rawSpanLines[previousLine], rawSpanLines[nextLine]);
        continue;
      }

      if (previousLine > 0 && nextLine === 0) {
        rawCentersPt[lineNumber] = rawCentersPt[previousLine];
        rawHeightsPt[lineNumber] = rawHeightsPt[previousLine];
        rawSpanLines[lineNumber] = rawSpanLines[previousLine];
        continue;
      }

      if (nextLine > 0 && previousLine === 0) {
        rawCentersPt[lineNumber] = rawCentersPt[nextLine];
        rawHeightsPt[lineNumber] = rawHeightsPt[nextLine];
        rawSpanLines[lineNumber] = rawSpanLines[nextLine];
        continue;
      }

      rawCentersPt[lineNumber] = defaultHeightPt * (lineNumber - 0.5);
      rawHeightsPt[lineNumber] = defaultHeightPt;
      rawSpanLines[lineNumber] = Number.POSITIVE_INFINITY;
    }

    for (let lineNumber = 1; lineNumber <= sourceLineCount; lineNumber += 1) {
      const heightPt = Math.max(0.25, rawHeightsPt[lineNumber] || defaultHeightPt);
      let centerPt = rawCentersPt[lineNumber];

      if (!Number.isFinite(centerPt)) {
        centerPt = heightPt * 0.5;
      }

      const halfHeightPt = heightPt * 0.5;
      const maxCenterPt = Math.max(halfHeightPt, totalDocumentHeightPt - halfHeightPt);
      centerPt = clamp(centerPt, halfHeightPt, maxCenterPt);

      const documentStartPt = clamp(centerPt - halfHeightPt, 0, totalDocumentHeightPt);
      let documentEndPt = clamp(centerPt + halfHeightPt, documentStartPt, totalDocumentHeightPt);
      if (documentEndPt <= documentStartPt) {
        documentEndPt = documentStartPt + 0.25;
      }
      const finalHeightPt = Math.max(0.25, documentEndPt - documentStartPt);
      const finalCenterPt = documentStartPt + (finalHeightPt * 0.5);

      const lineBox: SourceLineBox = {
        lineNumber,
        documentStartPt,
        documentEndPt,
        centerPt: finalCenterPt,
        heightPt: finalHeightPt,
        sourceSpanLines: rawSpanLines[lineNumber],
      };
      this.sourceLineBoxes.push(lineBox);
      this.sourceLineBoxByLine.set(lineNumber, lineBox);
    }
  }

  private getSourceLineCount(): number {
    const mappedLineCount = this.sourceMapping.reduce(
      (maxValue, entry) => Math.max(maxValue, Math.floor(entry.sourceLineEnd)),
      0,
    );
    const normalizedMarkdown = this.currentMarkdown
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const markdownLineCount = normalizedMarkdown.length > 0
      ? normalizedMarkdown.split('\n').length
      : 0;
    return Math.max(mappedLineCount, markdownLineCount);
  }

  private collectSourceLineCandidates(
    sourceLineCount: number,
    pageOffsetsPt: readonly number[],
  ): SourceLineCandidate[][] {
    const candidatesByLine = Array.from({ length: sourceLineCount + 1 }, () => [] as SourceLineCandidate[]);
    for (const entry of this.sourceMapping) {
      const safePageIndex = clamp(
        Math.floor(entry.pageIndex),
        0,
        this.pages.length - 1,
      );
      const pageHeightPt = Math.max(1, this.pages[safePageIndex]?.heightPt ?? 1);
      const pageOffsetPt = pageOffsetsPt[safePageIndex] ?? this.getPageDocumentOffsetPt(safePageIndex);
      const entryYStartPt = clamp(Math.min(entry.yStartPt, entry.yEndPt), 0, pageHeightPt);
      const entryYEndPt = clamp(Math.max(entry.yStartPt, entry.yEndPt), entryYStartPt, pageHeightPt);

      const safeLineStart = clamp(Math.floor(entry.sourceLineStart), 1, sourceLineCount);
      const safeLineEnd = clamp(
        Math.floor(entry.sourceLineEnd),
        safeLineStart,
        sourceLineCount,
      );
      const spanLineCount = Math.max(1, (safeLineEnd - safeLineStart) + 1);
      const entryHeightPt = Math.max(0.25, entryYEndPt - entryYStartPt);
      const perLineHeightPt = entryHeightPt / spanLineCount;

      for (let lineNumber = safeLineStart; lineNumber <= safeLineEnd; lineNumber += 1) {
        const lineOffset = lineNumber - safeLineStart;
        const yStartPt = entryYStartPt + (lineOffset * perLineHeightPt);
        const yEndPt = lineNumber === safeLineEnd
          ? entryYEndPt
          : yStartPt + perLineHeightPt;
        const documentStartPt = pageOffsetPt + yStartPt;
        const documentEndPt = pageOffsetPt + Math.max(yStartPt + 0.25, yEndPt);
        candidatesByLine[lineNumber].push({
          documentStartPt,
          documentEndPt,
          spanLines: spanLineCount,
          sourceLineStart: safeLineStart,
          sourceLineEnd: safeLineEnd,
        });
      }
    }

    return candidatesByLine;
  }

  private selectBestCandidate(
    candidates: readonly SourceLineCandidate[] | undefined,
    lineNumber: number,
  ): SourceLineCandidate | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    const smallestSpan = candidates.reduce(
      (smallest, candidate) => Math.min(smallest, candidate.spanLines),
      Number.POSITIVE_INFINITY,
    );

    const mostSpecificCandidates = candidates.filter((candidate) => candidate.spanLines === smallestSpan);
    if (mostSpecificCandidates.length === 1) {
      return mostSpecificCandidates[0];
    }

    const minSourceLine = mostSpecificCandidates.reduce(
      (minValue, candidate) => Math.min(minValue, candidate.sourceLineStart),
      Number.POSITIVE_INFINITY,
    );
    const maxSourceLine = mostSpecificCandidates.reduce(
      (maxValue, candidate) => Math.max(maxValue, candidate.sourceLineEnd),
      Number.NEGATIVE_INFINITY,
    );
    const sourceSpan = Math.max(1, maxSourceLine - minSourceLine);
    const clampedLine = clamp(Math.floor(lineNumber), minSourceLine, maxSourceLine);
    const normalized = (clampedLine - minSourceLine) / sourceSpan;
    const orderedByY = mostSpecificCandidates
      .slice()
      .sort((a, b) => a.documentStartPt - b.documentStartPt);
    const selectedIndex = Math.round(normalized * (orderedByY.length - 1));
    return orderedByY[clamp(selectedIndex, 0, orderedByY.length - 1)];
  }

  private resolveLineBox(lineNumber: number): SourceLineBox | null {
    if (this.sourceLineBoxes.length === 0) {
      return null;
    }

    const clampedLine = clamp(
      Math.floor(lineNumber),
      1,
      this.sourceLineBoxes.length,
    );
    return this.sourceLineBoxByLine.get(clampedLine) ?? this.sourceLineBoxes[clampedLine - 1] ?? null;
  }

  private findNearestLineBoxByDocumentY(documentYPt: number): SourceLineBox | null {
    if (this.sourceLineBoxes.length === 0) {
      return null;
    }

    let bestLineBox: SourceLineBox | null = null;
    let bestDistancePt = Number.POSITIVE_INFINITY;
    let bestSpanLines = Number.POSITIVE_INFINITY;
    let bestCenterDistancePt = Number.POSITIVE_INFINITY;

    for (const lineBox of this.sourceLineBoxes) {
      const distancePt = documentYPt < lineBox.documentStartPt
        ? lineBox.documentStartPt - documentYPt
        : documentYPt > lineBox.documentEndPt
          ? documentYPt - lineBox.documentEndPt
          : 0;
      const centerDistancePt = Math.abs(documentYPt - lineBox.centerPt);

      if (distancePt < bestDistancePt) {
        bestLineBox = lineBox;
        bestDistancePt = distancePt;
        bestSpanLines = lineBox.sourceSpanLines;
        bestCenterDistancePt = centerDistancePt;
        continue;
      }

      if (distancePt === bestDistancePt) {
        if (lineBox.sourceSpanLines < bestSpanLines) {
          bestLineBox = lineBox;
          bestSpanLines = lineBox.sourceSpanLines;
          bestCenterDistancePt = centerDistancePt;
          continue;
        }
        if (lineBox.sourceSpanLines === bestSpanLines && centerDistancePt < bestCenterDistancePt) {
          bestLineBox = lineBox;
          bestCenterDistancePt = centerDistancePt;
        }
      }
    }

    return bestLineBox;
  }

  private getMedian(values: readonly number[]): number | null {
    const finiteValues = values
      .filter((value) => Number.isFinite(value))
      .slice()
      .sort((a, b) => a - b);
    if (finiteValues.length === 0) {
      return null;
    }
    const middle = Math.floor(finiteValues.length / 2);
    if (finiteValues.length % 2 === 0) {
      return (finiteValues[middle - 1] + finiteValues[middle]) * 0.5;
    }
    return finiteValues[middle];
  }

  private getPageOffsetsPt(): number[] {
    const ptPerPx = 72 / 96;
    const pageGapPt = PAGE_GAP_PX * ptPerPx;
    const offsets: number[] = [];
    let runningOffsetPt = 0;
    for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
      offsets.push(runningOffsetPt);
      runningOffsetPt += this.pages[pageIndex].heightPt + pageGapPt;
    }
    return offsets;
  }

  private locateCanvasPosition(canvasY: number): { pageIndex: number; yOnPagePt: number } | null {
    if (this.pages.length === 0 || !Number.isFinite(canvasY)) {
      return null;
    }

    const ptPerPx = 72 / 96;
    const pageGapPt = PAGE_GAP_PX * ptPerPx;
    const yPt = Math.max(0, canvasY) * ptPerPx;

    let pageStartPt = 0;
    for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex += 1) {
      const pageHeightPt = this.pages[pageIndex].heightPt;
      const pageEndPt = pageStartPt + pageHeightPt;
      if (yPt <= pageEndPt) {
        return {
          pageIndex,
          yOnPagePt: clamp(yPt - pageStartPt, 0, pageHeightPt),
        };
      }

      const isLastPage = pageIndex === this.pages.length - 1;
      const nextPageStartPt = pageEndPt + pageGapPt;
      if (isLastPage) {
        break;
      }

      if (yPt <= nextPageStartPt) {
        const distanceToCurrentPage = yPt - pageEndPt;
        const distanceToNextPage = nextPageStartPt - yPt;
        if (distanceToCurrentPage <= distanceToNextPage) {
          return {
            pageIndex,
            yOnPagePt: pageHeightPt,
          };
        }
        return {
          pageIndex: pageIndex + 1,
          yOnPagePt: 0,
        };
      }

      pageStartPt = nextPageStartPt;
    }

    const lastPageIndex = this.pages.length - 1;
    return {
      pageIndex: lastPageIndex,
      yOnPagePt: this.pages[lastPageIndex].heightPt,
    };
  }

  private getPageDocumentOffsetPt(pageIndex: number): number {
    const ptPerPx = 72 / 96;
    const pageGapPt = PAGE_GAP_PX * ptPerPx;
    let offsetPt = 0;

    for (let i = 0; i < pageIndex && i < this.pages.length; i += 1) {
      offsetPt += this.pages[i].heightPt + pageGapPt;
    }

    return offsetPt;
  }
}

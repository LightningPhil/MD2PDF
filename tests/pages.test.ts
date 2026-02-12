import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PageManager } from '../src/pages'
import { typesetMarkdown } from '../src/typesetter'
import type { SourceMappingEntry } from '../src/typesetter'

// Mock the typesetter module
vi.mock('../src/typesetter', () => ({
  loadFonts: vi.fn().mockResolvedValue(undefined),
  typesetMarkdown: vi.fn().mockResolvedValue({
    pages: [{ index: 0, widthPt: 595, heightPt: 842, ops: [] }],
    diagnostics: { errors: [], warnings: [] },
    sourceMapping: [],
  }),
  renderToCanvas: vi.fn().mockResolvedValue(undefined),
  generatePdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // %PDF
  pxToPt: vi.fn((px: number) => px * 0.75),
  getPageDimensionsPx: vi.fn(() => ({ widthPx: 595, heightPx: 842 })),
}))

type TypesetResult = Awaited<ReturnType<typeof typesetMarkdown>>

function createTypesetResult(
  sourceMapping: SourceMappingEntry[] = [],
  pages: TypesetResult['pages'] = [{ index: 0, widthPt: 595, heightPt: 842, ops: [] }],
): TypesetResult {
  return {
    pages,
    diagnostics: { errors: [], warnings: [] },
    sourceMapping,
  }
}

async function flushMicrotasks(turns = 3): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve()
  }
}

async function createReadyManager(): Promise<PageManager> {
  const manager = new PageManager('previewContainer')
  await flushMicrotasks()
  return manager
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

describe('PageManager', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'previewContainer'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('initializes with container element', () => {
    const manager = new PageManager('previewContainer')
    expect(manager).toBeInstanceOf(PageManager)
  })

  it('throws error for missing container', () => {
    expect(() => new PageManager('nonexistent')).toThrow()
  })

  it('creates canvas element in container', () => {
    new PageManager('previewContainer')
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.className).toBe('preview-canvas')
  })

  it('getPageCount returns 1 for empty pages', () => {
    const manager = new PageManager('previewContainer')
    expect(manager.getPageCount()).toBe(1)
  })

  it('getCanvas returns canvas element', () => {
    const manager = new PageManager('previewContainer')
    const canvas = manager.getCanvas()
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
  })

  it('getPages returns empty array initially', () => {
    const manager = new PageManager('previewContainer')
    expect(manager.getPages()).toEqual([])
  })

  it('setZoom updates zoom level', () => {
    const manager = new PageManager('previewContainer')
    manager.setZoom(1.5)
    expect(manager.getZoom()).toBe(1.5)
  })

  it('getZoom returns default zoom of 1', () => {
    const manager = new PageManager('previewContainer')
    expect(manager.getZoom()).toBe(1)
  })

  it('getPageDimensions returns page size', () => {
    const manager = new PageManager('previewContainer')
    const dims = manager.getPageDimensions()
    expect(dims).toHaveProperty('widthPx')
    expect(dims).toHaveProperty('heightPx')
    expect(dims.widthPx).toBeGreaterThan(0)
    expect(dims.heightPx).toBeGreaterThan(0)
  })

  it('getTotalHeight calculates based on page count', () => {
    const manager = new PageManager('previewContainer')
    const totalHeight = manager.getTotalHeight()
    expect(totalHeight).toBeGreaterThan(0)
  })

  it('passes markdown to typesetter without trimming leading blank lines', async () => {
    const manager = await createReadyManager()
    const markdown = '\n\n# Heading'

    await manager.updateMarkdown(markdown)

    expect(vi.mocked(typesetMarkdown)).toHaveBeenLastCalledWith(markdown, expect.any(Object))
  })

  it('maps source lines to interpolated canvas positions', async () => {
    const manager = await createReadyManager()
    const mapping: SourceMappingEntry = {
      sourceLineStart: 10,
      sourceLineEnd: 14,
      pageIndex: 0,
      yStartPt: 100,
      yEndPt: 200,
    }
    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([mapping]))

    await manager.updateMarkdown('content')

    const position = manager.getCanvasYFromSourceLine(12)
    expect(position).not.toBeNull()
    expect(position?.height ?? 0).toBeGreaterThan(0)
    const roundTripLine = manager.getSourceLineFromCanvasY((position?.y ?? 0) + ((position?.height ?? 0) / 2))
    expect(roundTripLine).toBe(12)
  })

  it('maps canvas positions back to interpolated source lines', async () => {
    const manager = await createReadyManager()
    const mapping: SourceMappingEntry = {
      sourceLineStart: 10,
      sourceLineEnd: 14,
      pageIndex: 0,
      yStartPt: 100,
      yEndPt: 200,
    }
    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([mapping]))

    await manager.updateMarkdown('content')

    const line = manager.getSourceLineFromCanvasY(233.333)
    expect(line).toBe(13)
  })

  it('ignores stale async render results from older requests', async () => {
    const manager = await createReadyManager()
    const older = createDeferred<TypesetResult>()
    const newer = createDeferred<TypesetResult>()
    const mockTypeset = vi.mocked(typesetMarkdown)

    mockTypeset
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise)

    const olderUpdate = manager.updateMarkdown('older')
    const newerUpdate = manager.updateMarkdown('newer')

    newer.resolve(createTypesetResult([{
      sourceLineStart: 8,
      sourceLineEnd: 8,
      pageIndex: 0,
      yStartPt: 160,
      yEndPt: 180,
    }]))
    await newerUpdate

    older.resolve(createTypesetResult([{
      sourceLineStart: 2,
      sourceLineEnd: 2,
      pageIndex: 0,
      yStartPt: 80,
      yEndPt: 90,
    }]))
    await olderUpdate

    const latestLine8 = manager.getCanvasYFromSourceLine(8)
    const nearestForLine2 = manager.getCanvasYFromSourceLine(2)

    expect(latestLine8).not.toBeNull()
    expect(nearestForLine2?.y).toBeCloseTo(latestLine8?.y ?? 0, 3)
  })

  it('selects distributed exact matches when multiple entries cover the same source range', async () => {
    const manager = await createReadyManager()
    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([
      {
        sourceLineStart: 1,
        sourceLineEnd: 3,
        pageIndex: 0,
        yStartPt: 60,
        yEndPt: 90,
      },
      {
        sourceLineStart: 1,
        sourceLineEnd: 3,
        pageIndex: 0,
        yStartPt: 180,
        yEndPt: 210,
      },
      {
        sourceLineStart: 1,
        sourceLineEnd: 3,
        pageIndex: 0,
        yStartPt: 300,
        yEndPt: 330,
      },
    ]))

    await manager.updateMarkdown('one\ntwo\nthree')

    const line1Y = manager.getCanvasYFromSourceLine(1)?.y ?? 0
    const line2Y = manager.getCanvasYFromSourceLine(2)?.y ?? 0
    const line3Y = manager.getCanvasYFromSourceLine(3)?.y ?? 0

    expect(line1Y).toBeLessThan(line2Y)
    expect(line2Y).toBeLessThan(line3Y)
    expect(line2Y - line1Y).toBeGreaterThan(120)
    expect(line3Y - line2Y).toBeGreaterThan(120)
  })

  it('prefers the most specific overlapping mapping when resolving canvas click to source line', async () => {
    const manager = await createReadyManager()
    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([
      {
        sourceLineStart: 1,
        sourceLineEnd: 20,
        pageIndex: 0,
        yStartPt: 100,
        yEndPt: 300,
      },
      {
        sourceLineStart: 15,
        sourceLineEnd: 15,
        pageIndex: 0,
        yStartPt: 180,
        yEndPt: 200,
      },
    ]))

    await manager.updateMarkdown('content')

    const line = manager.getSourceLineFromCanvasY(253.333)
    expect(line).toBe(15)
  })

  it('keeps preview-to-editor mapping consistent with editor-to-preview mapping', async () => {
    const manager = await createReadyManager()
    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([
      {
        sourceLineStart: 1,
        sourceLineEnd: 30,
        pageIndex: 0,
        yStartPt: 90,
        yEndPt: 430,
      },
      {
        sourceLineStart: 14,
        sourceLineEnd: 14,
        pageIndex: 0,
        yStartPt: 205,
        yEndPt: 218,
      },
      {
        sourceLineStart: 21,
        sourceLineEnd: 21,
        pageIndex: 0,
        yStartPt: 315,
        yEndPt: 333,
      },
    ]))

    await manager.updateMarkdown('content')

    const criticalLines = [1, 8, 14, 21, 30]
    for (const lineNumber of criticalLines) {
      const position = manager.getCanvasYFromSourceLine(lineNumber)
      expect(position).not.toBeNull()

      const clickedLine = manager.getSourceLineFromCanvasY((position?.y ?? 0) + ((position?.height ?? 0) / 2))
      expect(clickedLine).toBe(lineNumber)
    }
  })

  it('maps clicks in inter-page gaps to the nearest page edge', async () => {
    const manager = await createReadyManager()
    const twoPages: TypesetResult['pages'] = [
      { index: 0, widthPt: 595, heightPt: 842, ops: [] },
      { index: 1, widthPt: 595, heightPt: 842, ops: [] },
    ]

    vi.mocked(typesetMarkdown).mockResolvedValueOnce(createTypesetResult([
      {
        sourceLineStart: 1,
        sourceLineEnd: 1,
        pageIndex: 0,
        yStartPt: 812,
        yEndPt: 832,
      },
      {
        sourceLineStart: 2,
        sourceLineEnd: 2,
        pageIndex: 1,
        yStartPt: 8,
        yEndPt: 24,
      },
    ], twoPages))

    await manager.updateMarkdown('line1\nline2')

    const ptPerPx = 72 / 96
    const firstPageHeightPx = twoPages[0].heightPt / ptPerPx
    const nearEndOfFirstPageGap = firstPageHeightPx + 5
    const nearStartOfSecondPageGap = firstPageHeightPx + 35

    expect(manager.getSourceLineFromCanvasY(nearEndOfFirstPageGap)).toBe(1)
    expect(manager.getSourceLineFromCanvasY(nearStartOfSecondPageGap)).toBe(2)
  })
})

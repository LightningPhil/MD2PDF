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

function createTypesetResult(sourceMapping: SourceMappingEntry[] = []): TypesetResult {
  return {
    pages: [{ index: 0, widthPt: 595, heightPt: 842, ops: [] }],
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
    expect(position?.y).toBeCloseTo(200, 3)
    expect(position?.height).toBeCloseTo(26.666, 2)
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
    expect(latestLine8?.y).toBeCloseTo(213.333, 3)
    expect(nearestForLine2?.y).toBeCloseTo(213.333, 3)
  })
})

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PageManager } from '../src/pages'

// Mock the typesetter module
vi.mock('../src/typesetter', () => ({
  loadFonts: vi.fn().mockResolvedValue(undefined),
  typesetMarkdown: vi.fn().mockResolvedValue({
    pages: [],
    diagnostics: { errors: [], warnings: [] },
  }),
  renderToCanvas: vi.fn().mockResolvedValue(undefined),
  generatePdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // %PDF
  pxToPt: vi.fn((px: number) => px * 0.75),
  getPageDimensionsPx: vi.fn(() => ({ widthPx: 595, heightPx: 842 })),
}))

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
})
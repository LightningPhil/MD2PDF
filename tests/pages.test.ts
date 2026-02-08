import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PageManager } from '../src/pages'

// Mock the paginate function
vi.mock('../src/paginator', () => ({
  paginate: vi.fn((content: HTMLElement, height: number) => {
    // Return a simple mock page
    const page = document.createElement('div')
    page.className = 'page-content'
    page.innerHTML = content.innerHTML
    return [page]
  })
}))

// Mock renderMath
vi.mock('../src/katex', () => ({
  renderMath: vi.fn(),
  MathRenderMode: {}
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

  it('getMathMode returns default html mode', () => {
    const manager = new PageManager('previewContainer')
    expect(manager.getMathMode()).toBe('html')
  })

  it('setMathMode updates the math mode', () => {
    const manager = new PageManager('previewContainer')
    manager.setMathMode('svg')
    expect(manager.getMathMode()).toBe('svg')
  })

  it('getPageCount returns 0 initially', () => {
    const manager = new PageManager('previewContainer')
    expect(manager.getPageCount()).toBe(0)
  })

  it('updatePages clears container and adds new pages', () => {
    const manager = new PageManager('previewContainer')
    const content = document.createElement('div')
    content.innerHTML = '<p>Test content</p>'
    
    manager.updatePages(content)
    
    expect(container.querySelectorAll('.page').length).toBeGreaterThanOrEqual(1)
  })

  it('updatePages shows placeholder for empty content', async () => {
    const manager = new PageManager('previewContainer')
    const content = document.createElement('div')
    
    // Mock paginate to return empty array for empty content
    const { paginate } = await import('../src/paginator')
    vi.mocked(paginate).mockReturnValueOnce([])
    
    manager.updatePages(content)
    
    expect(container.textContent).toContain('Preview will appear here')
  })

  it('updatePages adds page numbers', () => {
    const manager = new PageManager('previewContainer')
    const content = document.createElement('div')
    content.innerHTML = '<p>Content</p>'
    
    manager.updatePages(content)
    
    expect(container.querySelector('.page-number')).toBeTruthy()
  })
})
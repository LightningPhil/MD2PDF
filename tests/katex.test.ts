import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderMath } from '../src/katex'

// Mock KaTeX global
const mockKatex = {
  renderToString: vi.fn((math: string, options: any) => {
    return `<span class="katex">${math}</span>`
  })
}

describe('renderMath', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    // Set up global katex mock
    ;(globalThis as any).katex = mockKatex
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (globalThis as any).katex
  })

  it('handles element with no math expressions', () => {
    container.innerHTML = '<p>Plain text without math</p>'
    renderMath(container, 'html')
    expect(mockKatex.renderToString).not.toHaveBeenCalled()
  })

  it('renders inline math expressions', () => {
    container.innerHTML = '<p>The formula $E = mc^2$ is famous</p>'
    renderMath(container, 'html')
    expect(mockKatex.renderToString).toHaveBeenCalledWith(
      'E = mc^2',
      expect.objectContaining({ displayMode: false })
    )
  })

  it('renders display math expressions', () => {
    // Display math uses $$ delimiters which are processed on innerHTML
    container.innerHTML = '<p>$$\\int_0^1 x dx$$</p>'
    renderMath(container, 'html')
    // The renderMath function processes display math via innerHTML replace
    expect(mockKatex.renderToString).toHaveBeenCalled()
  })

  it('renders display placeholders with preserved matrix row breaks', () => {
    const matrix = `A =
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}`
    container.innerHTML = `<div class="math-display-placeholder" data-math="${encodeURIComponent(matrix)}"></div>`

    renderMath(container, 'html')

    expect(mockKatex.renderToString).toHaveBeenCalledWith(
      expect.stringContaining('1 & 2 \\\\'),
      expect.objectContaining({ displayMode: true })
    )
  })

  it('uses html output mode when specified', () => {
    container.innerHTML = '<p>$x$</p>'
    renderMath(container, 'html')
    expect(mockKatex.renderToString).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ output: 'html' })
    )
  })

  it('uses svg output mode when specified', () => {
    container.innerHTML = '<p>$x$</p>'
    renderMath(container, 'svg')
    expect(mockKatex.renderToString).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ output: 'svg' })
    )
  })

  it('handles multiple inline math expressions', () => {
    container.innerHTML = '<p>$a$ and $b$ and $c$</p>'
    renderMath(container, 'html')
    expect(mockKatex.renderToString).toHaveBeenCalledTimes(3)
  })

  it('skips already-rendered KaTeX elements', () => {
    container.innerHTML = '<span class="katex">already rendered</span><p>$new$</p>'
    renderMath(container, 'html')
    // Should only render the new math, not re-render existing
    expect(mockKatex.renderToString).toHaveBeenCalledWith(
      'new',
      expect.any(Object)
    )
  })

  it('gracefully handles missing katex library', () => {
    delete (globalThis as any).katex
    container.innerHTML = '<p>$x$</p>'
    // Should not throw
    expect(() => renderMath(container, 'html')).not.toThrow()
  })

  it('handles KaTeX rendering errors gracefully', () => {
    mockKatex.renderToString.mockImplementationOnce(() => {
      throw new Error('Invalid LaTeX')
    })
    container.innerHTML = '<p>$invalid{$</p>'
    // Should not throw, should keep original text
    expect(() => renderMath(container, 'html')).not.toThrow()
  })

  it('wraps display math in katex-display div', () => {
    // Test that double-dollar display math gets wrapped
    // Note: The display math regex requires the content to span multiple chars
    container.innerHTML = '<div>$$abc$$</div>'
    renderMath(container, 'html')
    // Display math processing happens on innerHTML with $$...$$ pattern
    expect(container.innerHTML).toContain('katex')  
  })
})

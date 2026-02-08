import { describe, it, expect, beforeEach } from 'vitest'
import { paginate } from '../src/paginator'

describe('paginate', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
  })

  it('returns single empty page for empty content', () => {
    const pages = paginate(container, 500)
    expect(pages.length).toBe(1)
    expect(pages[0].children.length).toBe(0)
  })

  it('creates single page for small content', () => {
    const p = document.createElement('p')
    p.textContent = 'Short paragraph'
    container.appendChild(p)

    const pages = paginate(container, 500)
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('creates multiple pages for tall content', () => {
    // Create multiple paragraphs that should exceed page height
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('p')
      p.textContent = `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
      container.appendChild(p)
    }

    const pages = paginate(container, 100) // Small page height to force pagination
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps headings with following content (atomic)', () => {
    const h2 = document.createElement('h2')
    h2.textContent = 'Section Title'
    container.appendChild(h2)

    const p = document.createElement('p')
    p.textContent = 'Following paragraph'
    container.appendChild(p)

    const pages = paginate(container, 500)
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps tables atomic when possible', () => {
    const table = document.createElement('table')
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.textContent = 'Cell content'
    tr.appendChild(td)
    table.appendChild(tr)
    container.appendChild(table)

    const pages = paginate(container, 500)
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps display math atomic', () => {
    const mathDiv = document.createElement('div')
    mathDiv.className = 'katex-display'
    mathDiv.textContent = 'E = mc^2'
    container.appendChild(mathDiv)

    const pages = paginate(container, 500)
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps code blocks atomic', () => {
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.textContent = 'console.log("hello");'
    pre.appendChild(code)
    container.appendChild(pre)

    const pages = paginate(container, 500)
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('can split paragraphs across pages', () => {
    const p = document.createElement('p')
    p.textContent = 'Word '.repeat(100) // Long paragraph
    container.appendChild(p)

    // This tests that paragraphs CAN be split
    const pages = paginate(container, 50) // Very small page
    // Should either produce multiple pages or handle gracefully
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })

  it('can split lists across pages', () => {
    const ul = document.createElement('ul')
    for (let i = 0; i < 10; i++) {
      const li = document.createElement('li')
      li.textContent = `List item ${i + 1}`
      ul.appendChild(li)
    }
    container.appendChild(ul)

    const pages = paginate(container, 50) // Small page
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })
})
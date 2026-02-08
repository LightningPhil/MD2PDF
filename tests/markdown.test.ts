import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/markdown'

describe('renderMarkdown', () => {
  it('renders plain text paragraph', () => {
    const result = renderMarkdown('Hello world')
    expect(result).toBeInstanceOf(HTMLElement)
    expect(result.textContent).toContain('Hello world')
  })

  it('renders headings', () => {
    const result = renderMarkdown('# Heading 1\n## Heading 2')
    expect(result.querySelector('h1')).toBeTruthy()
    expect(result.querySelector('h2')).toBeTruthy()
  })

  it('renders bold text', () => {
    const result = renderMarkdown('**bold text**')
    const strong = result.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong?.textContent).toBe('bold text')
  })

  it('renders italic text', () => {
    const result = renderMarkdown('*italic text*')
    const em = result.querySelector('em')
    expect(em).toBeTruthy()
    expect(em?.textContent).toBe('italic text')
  })

  it('renders unordered lists', () => {
    const result = renderMarkdown('- Item 1\n- Item 2\n- Item 3')
    const ul = result.querySelector('ul')
    expect(ul).toBeTruthy()
    const items = ul?.querySelectorAll('li')
    expect(items?.length).toBe(3)
  })

  it('renders ordered lists', () => {
    const result = renderMarkdown('1. First\n2. Second\n3. Third')
    const ol = result.querySelector('ol')
    expect(ol).toBeTruthy()
    const items = ol?.querySelectorAll('li')
    expect(items?.length).toBe(3)
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconst x = 1;\n```')
    const pre = result.querySelector('pre')
    expect(pre).toBeTruthy()
  })

  it('renders inline code', () => {
    const result = renderMarkdown('Use `console.log()` for debugging')
    const code = result.querySelector('code')
    expect(code).toBeTruthy()
    expect(code?.textContent).toBe('console.log()')
  })

  it('renders links', () => {
    const result = renderMarkdown('[Link text](https://example.com)')
    const link = result.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('https://example.com')
    expect(link?.textContent).toBe('Link text')
  })

  it('renders blockquotes', () => {
    const result = renderMarkdown('> This is a quote')
    const blockquote = result.querySelector('blockquote')
    expect(blockquote).toBeTruthy()
    expect(blockquote?.textContent).toContain('This is a quote')
  })

  it('renders horizontal rules', () => {
    const result = renderMarkdown('Above\n\n---\n\nBelow')
    const hr = result.querySelector('hr')
    expect(hr).toBeTruthy()
  })

  it('renders tables', () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |`
    const result = renderMarkdown(md)
    const table = result.querySelector('table')
    expect(table).toBeTruthy()
    expect(result.querySelectorAll('th').length).toBe(2)
    expect(result.querySelectorAll('td').length).toBe(2)
  })

  it('creates inline math placeholders for KaTeX processing', () => {
    const result = renderMarkdown('The formula $E = mc^2$ is famous')
    const placeholder = result.querySelector('.math-inline-placeholder') as HTMLElement
    expect(placeholder).toBeTruthy()
    expect(decodeURIComponent(placeholder.dataset.math ?? '')).toBe('E = mc^2')
  })

  it('creates display math placeholders for KaTeX processing', () => {
    const result = renderMarkdown('$$\\int_0^1 x dx$$')
    const placeholder = result.querySelector('.math-display-placeholder') as HTMLElement
    expect(placeholder).toBeTruthy()
    expect(decodeURIComponent(placeholder.dataset.math ?? '')).toContain('\\int_0^1 x dx')
  })

  it('preserves matrix row breaks in display math placeholders', () => {
    const matrixMarkdown = `$$
\\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
$$`

    const result = renderMarkdown(matrixMarkdown)
    const placeholder = result.querySelector('.math-display-placeholder') as HTMLElement
    expect(placeholder).toBeTruthy()
    const math = decodeURIComponent(placeholder.dataset.math ?? '')
    expect(math).toContain('1 & 2 \\\\')
  })

  it('handles empty input', () => {
    const result = renderMarkdown('')
    expect(result).toBeInstanceOf(HTMLElement)
  })

  it('handles complex nested content', () => {
    const md = `# Title

This is a paragraph with **bold** and *italic*.

- List item 1
  - Nested item
- List item 2

\`\`\`
code block
\`\`\`
`
    const result = renderMarkdown(md)
    expect(result.querySelector('h1')).toBeTruthy()
    expect(result.querySelector('strong')).toBeTruthy()
    expect(result.querySelector('em')).toBeTruthy()
    expect(result.querySelector('ul')).toBeTruthy()
    expect(result.querySelector('pre')).toBeTruthy()
  })
})

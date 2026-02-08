import { describe, it, expect, beforeEach } from 'vitest'
import { MarkdownEditor } from '../src/editor'

describe('MarkdownEditor', () => {
  let textarea: HTMLTextAreaElement

  beforeEach(() => {
    // Create a textarea element for testing
    textarea = document.createElement('textarea')
    textarea.id = 'testEditor'
    document.body.appendChild(textarea)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes with textarea element', () => {
    const editor = new MarkdownEditor('testEditor')
    expect(editor).toBeInstanceOf(MarkdownEditor)
  })

  it('throws error for missing textarea', () => {
    expect(() => new MarkdownEditor('nonexistent')).toThrow()
  })

  it('getContent returns textarea value', () => {
    textarea.value = 'Test content'
    const editor = new MarkdownEditor('testEditor')
    expect(editor.getContent()).toBe('Test content')
  })

  it('setContent updates textarea value', () => {
    const editor = new MarkdownEditor('testEditor')
    editor.setContent('New content')
    expect(textarea.value).toBe('New content')
  })

  it('clear empties textarea', () => {
    textarea.value = 'Some content'
    const editor = new MarkdownEditor('testEditor')
    editor.clear()
    expect(textarea.value).toBe('')
  })

  it('onChange callback is called when content changes', () => {
    const editor = new MarkdownEditor('testEditor')
    let callbackValue = ''
    
    editor.onChange((content) => {
      callbackValue = content
    })
    
    editor.setContent('Changed content')
    expect(callbackValue).toBe('Changed content')
  })

  it('insertText inserts at cursor position', () => {
    const editor = new MarkdownEditor('testEditor')
    textarea.value = 'Hello world'
    textarea.selectionStart = 6
    textarea.selectionEnd = 6
    
    editor.insertText('beautiful ')
    expect(textarea.value).toBe('Hello beautiful world')
  })

  it('getSelectedText returns selected portion', () => {
    const editor = new MarkdownEditor('testEditor')
    textarea.value = 'Hello world'
    textarea.selectionStart = 0
    textarea.selectionEnd = 5
    
    expect(editor.getSelectedText()).toBe('Hello')
  })

  it('wrapSelection wraps selected text', () => {
    const editor = new MarkdownEditor('testEditor')
    textarea.value = 'Hello world'
    textarea.selectionStart = 0
    textarea.selectionEnd = 5
    
    editor.wrapSelection('**')
    expect(textarea.value).toBe('**Hello** world')
  })

  it('focus sets focus on textarea', () => {
    const editor = new MarkdownEditor('testEditor')
    editor.focus()
    expect(document.activeElement).toBe(textarea)
  })

  it('removeChangeListener removes callback', () => {
    const editor = new MarkdownEditor('testEditor')
    let callCount = 0
    
    const callback = () => { callCount++ }
    editor.onChange(callback)
    editor.setContent('First change')
    expect(callCount).toBe(1)
    
    editor.removeChangeListener(callback)
    editor.setContent('Second change')
    expect(callCount).toBe(1) // Should not increase
  })
})

// Add afterEach import
import { afterEach } from 'vitest'
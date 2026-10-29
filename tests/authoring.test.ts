import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  if (!document.doctype) document.insertBefore(document.implementation.createDocumentType('html', '', ''), document.documentElement);
});
import { MarkdownEditor } from '../src/editor';
import { AuthoringTools, equationAt, latexEquationAt, formatSelection } from '../src/authoring';

describe('authoring tools', () => {
  let editor: MarkdownEditor;
  let textarea: HTMLTextAreaElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="formattingToolbar"></div><textarea id="markdownEditor"></textarea>';
    textarea = document.querySelector('textarea')!;
    editor = new MarkdownEditor('markdownEditor');
  });
  afterEach(() => { document.body.innerHTML = ''; });
  const select = (text: string, start = 0, end = text.length) => {
    editor.setContent(text);
    textarea.setSelectionRange(start, end);
  };

  it('formats the selection, retains it and toggles emphasis off', () => {
    select('Hello world', 6, 11);
    formatSelection(editor, 'bold');
    expect(editor.getContent()).toBe('Hello **world**');
    expect(editor.getSelectedText()).toBe('world');
    formatSelection(editor, 'bold');
    expect(editor.getContent()).toBe('Hello world');
  });
  it('uses a selected placeholder when nothing is selected', () => {
    select('Hello ', 6, 6);
    formatSelection(editor, 'italic');
    expect(editor.getContent()).toBe('Hello *text*');
    expect(editor.getSelectedText()).toBe('text');
  });
  it('makes formatting a single undoable change and restores selection', () => {
    select('Hello world', 6, 11);
    formatSelection(editor, 'bold');
    editor.undo();
    expect(editor.getContent()).toBe('Hello world');
    expect(editor.getSelectedText()).toBe('world');
    editor.redo();
    expect(editor.getContent()).toBe('Hello **world**');
  });
  it('updates whole selected lines without consuming the next line', () => {
    select('one\ntwo\nthree', 0, 8);
    formatSelection(editor, 'number');
    expect(editor.getContent()).toBe('1. one\n2. two\nthree');
    formatSelection(editor, 'number');
    expect(editor.getContent()).toBe('one\ntwo\nthree');
  });
  it('replaces an existing heading level', () => {
    select('## Title', 5, 5);
    formatSelection(editor, 'heading', 1);
    expect(editor.getContent()).toBe('# Title');
  });
  it('selects the URL after inserting a link', () => {
    select('A link', 2, 6);
    formatSelection(editor, 'link');
    expect(editor.getContent()).toBe('A [link](https://example.com)');
    expect(editor.getSelectedText()).toBe('https://example.com');
  });
  it('separates tables from surrounding paragraphs', () => {
    select('BeforeAfter', 6, 6);
    formatSelection(editor, 'table');
    expect(editor.getContent()).toContain('Before\n\n| Column 1');
    expect(editor.getContent()).toContain('| Value | Value |\n\nAfter');
  });
  it('finds an equation containing the caret or selection', () => {
    expect(equationAt('Let $x^2$ grow.', 6, 6)).toEqual({ start: 4, end: 9, source: 'x^2', display: false });
    expect(equationAt('$$\nx^2\n$$', 3, 6)?.display).toBe(true);
  });
  it('ignores equations in code and escaped currency', () => {
    const text = '`$x$`\n```tex\n$y$\n```\n\\$5';
    expect(equationAt(text, 3, 3)).toBeNull();
    expect(equationAt(text, 15, 15)).toBeNull();
    expect(equationAt(text, 25, 25)).toBeNull();
  });
  it('opens from a selection, validates math and preserves the document on cancel', () => {
    select('A x^2 B', 2, 5);
    new AuthoringTools(editor);
    document.querySelector<HTMLButtonElement>('.equation-button')!.click();
    const source = document.querySelector<HTMLTextAreaElement>('#equationSource')!;
    expect(source.value).toBe('x^2');
    expect(document.querySelector('#equationPreview .katex')).not.toBeNull();
    source.value = '\\frac{';
    source.dispatchEvent(new Event('input'));
    expect(document.querySelector<HTMLButtonElement>('#insertEquation')!.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    expect(editor.getContent()).toBe('A x^2 B');
  });
  it('updates an existing equation without duplicating its delimiters', () => {
    select('A $x^2$ B', 4, 4);
    new AuthoringTools(editor);
    document.querySelector<HTMLButtonElement>('.equation-button')!.click();
    const source = document.querySelector<HTMLTextAreaElement>('#equationSource')!;
    expect(source.value).toBe('x^2');
    source.value = 'x^3';
    source.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>('#insertEquation')!.click();
    expect(editor.getContent()).toBe('A $x^3$ B');
    editor.undo();
    expect(editor.getContent()).toBe('A $x^2$ B');
  });
  it('validates every built-in equation template', () => {
    new AuthoringTools(editor);
    document.querySelector<HTMLButtonElement>('.equation-button')!.click();
    const templates = document.querySelector<HTMLSelectElement>('#equationTemplate')!;
    for (let i = 1; i < templates.options.length; i++) {
      templates.selectedIndex = i;
      templates.dispatchEvent(new Event('change'));
      expect(document.querySelector('#equationError')!.textContent).toBe('');
      expect(document.querySelector('#equationPreview .katex')).not.toBeNull();
    }
  });
  it('wraps selected math as a fraction and selects its denominator for editing', () => {
    select('x^2');
    new AuthoringTools(editor);
    document.querySelector<HTMLButtonElement>('.equation-button')!.click();
    const source = document.querySelector<HTMLTextAreaElement>('#equationSource')!;
    source.setSelectionRange(0, source.value.length);
    document.querySelector<HTMLButtonElement>('.equation-structures button')!.click();
    expect(source.value).toBe('\\frac{x^2}{b}');
    expect(source.value.slice(source.selectionStart, source.selectionEnd)).toBe('b');
    expect(document.querySelector('#equationError')!.textContent).toBe('');
  });
  it('prevents inserting multiline LaTeX as inline Markdown math', () => {
    new AuthoringTools(editor);
    document.querySelector<HTMLButtonElement>('.equation-button')!.click();
    const source = document.querySelector<HTMLTextAreaElement>('#equationSource')!;
    source.value = 'x +\ny';
    const placement = document.querySelector<HTMLSelectElement>('#equationDisplay')!;
    placement.value = 'inline';
    placement.dispatchEvent(new Event('change'));
    expect(document.querySelector<HTMLButtonElement>('#insertEquation')!.disabled).toBe(true);
  });
});


describe('native LaTeX equation editing', () => {
  it('extracts a labelled native equation without duplicating the label', () => {
    const source = String.raw`Before \begin{equation} E=mc^2 \label{eq:energy} \end{equation} after`;
    expect(latexEquationAt(source, 30, 30)).toMatchObject({ source: 'E=mc^2', label: 'eq:energy', display: true });
  });
  it('recognizes native inline and display delimiters', () => {
    expect(latexEquationAt(String.raw`\(x^2\)`, 3, 3)).toMatchObject({ source: 'x^2', display: false });
    expect(latexEquationAt(String.raw`\[x^2\]`, 3, 3)).toMatchObject({ source: 'x^2', display: true });
  });
  it('does not consume an equation outside the selection', () => {
    expect(latexEquationAt(String.raw`Text \[x^2\]`, 0, 0)).toBeNull();
  });
});

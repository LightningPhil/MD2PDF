import katex from 'katex';
import { MarkdownEditor } from './editor.js';
import { validLabel } from './document.js';

export type Format = 'bold' | 'italic' | 'strike' | 'code' | 'heading' | 'bullet' | 'number' | 'quote' | 'link' | 'table' | 'rule' | 'codeblock';

/** Apply a single undoable edit, retaining a useful selection for continued typing. */
export function formatSelection(editor: MarkdownEditor, format: Format, heading = 2): void {
  const { start, end } = editor.getSelection();
  const content = editor.getContent();
  const selected = content.slice(start, end);
  const wrappers: Partial<Record<Format, string>> = { bold: '**', italic: '*', strike: '~~', code: '`' };
  const wrapper = wrappers[format];
  if (wrapper) {
    if (selected.startsWith(wrapper) && selected.endsWith(wrapper) && selected.length >= wrapper.length * 2) {
      const plain = selected.slice(wrapper.length, -wrapper.length);
      editor.replaceRange(start, end, plain, 0, plain.length);
    } else if (content.slice(start - wrapper.length, start) === wrapper && content.slice(end, end + wrapper.length) === wrapper) {
      editor.replaceRange(start - wrapper.length, end + wrapper.length, selected, 0, selected.length);
    } else {
      const text = selected || 'text';
      editor.replaceRange(start, end, wrapper + text + wrapper, wrapper.length, wrapper.length + text.length);
    }
  } else if (['heading', 'bullet', 'number', 'quote'].includes(format)) {
    const lineStart = start === 0 ? 0 : content.lastIndexOf('\n', start - 1) + 1;
    const lastSelected = end > start && content[end - 1] === '\n' ? end - 1 : end;
    const nextLine = content.indexOf('\n', lastSelected);
    const lineEnd = nextLine < 0 ? content.length : nextLine;
    const lines = content.slice(lineStart, lineEnd).split('\n');
    const prefix = (i: number) => format === 'heading' ? '#'.repeat(heading) + ' ' : format === 'quote' ? '> ' : format === 'number' ? `${i + 1}. ` : '- ';
    const pattern = format === 'heading' ? /^#{1,6}\s+/ : format === 'quote' ? /^>\s?/ : /^(?:[-+*]|\d+\.)\s+/;
    const remove = format !== 'heading' && lines.every((line, i) => line.startsWith(prefix(i)));
    const text = lines.map((line, i) => (remove ? '' : prefix(i)) + line.replace(pattern, '')).join('\n');
    editor.replaceRange(lineStart, lineEnd, text, 0, text.length);
  } else if (format === 'link') {
    const text = `[${selected || 'link text'}](https://example.com)`;
    const urlStart = text.indexOf('https://');
    editor.replaceRange(start, end, text, urlStart, text.length - 1);
  } else {
    const snippets = { table: '| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |', rule: '---', codeblock: '```\n' + (selected || 'code') + '\n```' };
    const body = snippets[format as keyof typeof snippets];
    const before = content.slice(0, start);
    const after = content.slice(end);
    const prefix = before ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : '';
    const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    editor.replaceRange(start, end, prefix + body + suffix);
  }
  editor.focus();
}

/** Locate an existing equation at the selection, ignoring fenced and inline code. */
export function equationAt(content: string, start: number, end: number): { start: number; end: number; source: string; display: boolean; label?: string } | null {
  const tokens = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|(?<![\\$])\$\$([\s\S]+?)\$\$(?:[ \t]*\{#(eq:[\w:-]+)\})?|(?<![\\$])\$([^$\n]+?)\$(?!\$)/g;
  for (const match of content.matchAll(tokens)) {
    if (match[1] === undefined && match[3] === undefined) continue;
    const from = match.index!;
    const to = from + match[0].length;
    if (start >= from && end <= to && start < to) {
      return { start: from, end: to, source: (match[1] ?? match[3]).trim(), display: match[1] !== undefined, ...(match[2] ? { label: match[2] } : {}) };
    }
  }
  return null;
}

const templates: [string, string][] = [
  ['Function', 'f(x) = ax^2 + bx + c'], ['Fraction', '\\frac{a}{b}'],
  ['Power', 'x^{n}'], ['Subscript', 'x_{i}'], ['Square root', '\\sqrt{x}'],
  ['Sum', '\\sum_{i=1}^{n} x_i'], ['Integral', '\\int_{a}^{b} f(x)\\,dx'],
  ['Limit', '\\lim_{x \\to 0} f(x)'], ['Derivative', '\\frac{d}{dx} f(x)'],
  ['Matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['Cases', 'f(x) = \\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}'],
  ['Aligned equations', '\\begin{aligned} y &= mx + b \\\\ z &= x^2 + y^2 \\end{aligned}'],
];

export function latexEquationAt(content: string, start: number, end: number): ReturnType<typeof equationAt> {
  const pattern = /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  for (const match of content.matchAll(pattern)) {
    const from = match.index!;
    if (start < from || start >= from + match[0].length || end > from + match[0].length) continue;
    const source = match[1] ?? match[2] ?? match[3];
    const label = /\\label\{([^}]+)\}/.exec(source)?.[1];
    return { start: from, end: from + match[0].length, source: source.replace(/\\label\{[^}]+\}/g, '').trim(), display: match[3] === undefined, label };
  }
  return equationAt(content, start, end);
}

export class AuthoringTools {
  private dialog: HTMLDialogElement;
  private source: HTMLTextAreaElement;
  private display: HTMLSelectElement;
  private preview: HTMLElement;
  private error: HTMLElement;
  private insert: HTMLButtonElement;
  private range = { start: 0, end: 0 };

  constructor(private editor: MarkdownEditor) {
    const toolbar = document.getElementById('formattingToolbar')!;
    const controls: [Format, string, string][] = [
      ['bold', 'B', 'Bold (Ctrl/Cmd+B)'], ['italic', 'I', 'Italic (Ctrl/Cmd+I)'],
      ['strike', 'S', 'Strikethrough'], ['code', '</>', 'Inline code'],
      ['bullet', '• List', 'Bullet list'], ['number', '1. List', 'Numbered list'],
      ['quote', '❝', 'Block quote'], ['link', 'Link', 'Insert link (Ctrl/Cmd+K)'],
      ['table', 'Table', 'Insert table'], ['codeblock', '{ }', 'Code block'], ['rule', '―', 'Horizontal rule'],
    ];
    toolbar.innerHTML = `<select aria-label="Heading level"><option value="">Heading</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>`;
    for (const [format, label, title] of controls) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.title = title;
      button.setAttribute('aria-label', title);
      button.dataset.format = format;
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => formatSelection(editor, format));
      toolbar.append(button);
    }
    const heading = toolbar.querySelector('select')!;
    heading.addEventListener('change', () => {
      if (heading.value) formatSelection(editor, 'heading', Number(heading.value));
      heading.value = '';
    });
    const equation = document.createElement('button');
    equation.type = 'button';
    equation.className = 'equation-button';
    equation.textContent = 'ƒx Equation';
    equation.title = 'Insert or edit equation (Ctrl/Cmd+Shift+E)';
    equation.addEventListener('mousedown', e => e.preventDefault());
    equation.addEventListener('click', () => this.open());
    toolbar.append(equation);

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'equation-dialog';
    this.dialog.setAttribute('aria-labelledby', 'equationTitle');
    this.dialog.innerHTML = `
      <div class="equation-header"><div><h2 id="equationTitle">Function & equation editor</h2><p>Build an expression, preview it, then add it to your Markdown.</p></div><button type="button" data-close aria-label="Close equation editor">×</button></div>
      <div class="equation-body"><label for="equationTemplate">Start with a template</label><select id="equationTemplate"><option value="">Choose a template…</option></select>
      <div class="equation-symbols" aria-label="Insert math symbols"></div>
      <div class="equation-structures" aria-label="Build expression at cursor"></div>
      <label for="equationSource">LaTeX expression</label><textarea id="equationSource" spellcheck="false" rows="5" aria-describedby="equationHelp equationError"></textarea>
      <p id="equationHelp">Templates replace the expression. Structure buttons wrap selected text or insert at the cursor. Edit letters and values directly; omit $ delimiters.</p>
      <label for="equationDisplay">Placement</label><select id="equationDisplay"><option value="display">On its own line (display)</option><option value="inline">Within a sentence (inline)</option></select>
      <label for="equationLabel">Reference label (optional)</label><input id="equationLabel" placeholder="eq:energy" aria-describedby="equationLabelHelp"><p id="equationLabelHelp" class="tool-help">Label a display equation to refer to it elsewhere. Example: eq:energy.</p>
      <div class="equation-preview-label">Live preview</div><div id="equationPreview" class="equation-preview"></div><p id="equationError" class="equation-error" role="status" aria-live="polite"></p></div>
      <div class="equation-actions"><button type="button" data-close>Cancel</button><button type="button" id="insertEquation">Insert equation</button></div>`;
    document.body.append(this.dialog);
    this.source = this.dialog.querySelector('#equationSource')!;
    this.display = this.dialog.querySelector('#equationDisplay')!;
    this.preview = this.dialog.querySelector('#equationPreview')!;
    this.error = this.dialog.querySelector('#equationError')!;
    this.insert = this.dialog.querySelector('#insertEquation')!;
    const templateSelect = this.dialog.querySelector<HTMLSelectElement>('#equationTemplate')!;
    templates.forEach(([label], i) => {
      const option = document.createElement('option');
      option.textContent = label;
      option.value = String(i);
      templateSelect.append(option);
    });
    templateSelect.addEventListener('change', () => {
      if (templateSelect.value === '') return;
      this.source.value = templates[Number(templateSelect.value)][1];
      templateSelect.value = '';
      this.updatePreview();
      this.source.focus();
      this.source.select();
    });
    const structures: [string, (selected: string) => [string, number, number]][] = [
      ['Fraction', selected => selected ? [`\\frac{${selected}}{b}`, selected.length + 8, selected.length + 9] : ['\\frac{a}{b}', 6, 7]],
      ['Square root', selected => [`\\sqrt{${selected || 'x'}}`, 6, 6 + (selected || 'x').length]],
      ['Power', selected => [`${selected ? `{${selected}}` : 'x'}^{n}`, (selected ? selected.length + 2 : 1) + 2, (selected ? selected.length + 2 : 1) + 3]],
      ['Subscript', selected => [`${selected ? `{${selected}}` : 'x'}_{i}`, (selected ? selected.length + 2 : 1) + 2, (selected ? selected.length + 2 : 1) + 3]],
    ];
    structures.forEach(([label, build]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.title = `Insert ${label.toLowerCase()} at cursor`;
      button.addEventListener('click', () => {
        const start = this.source.selectionStart;
        const end = this.source.selectionEnd;
        const [text, selectStart, selectEnd] = build(this.source.value.slice(start, end));
        this.source.setRangeText(text, start, end, 'end');
        this.source.focus();
        this.source.setSelectionRange(start + selectStart, start + selectEnd);
        this.updatePreview();
      });
      this.dialog.querySelector('.equation-structures')!.append(button);
    });
    const symbols: [string, string][] = [['π', '\\pi'], ['θ', '\\theta'], ['α', '\\alpha'], ['β', '\\beta'], ['∞', '\\infty'], ['×', '\\times'], ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\ne'], ['±', '\\pm']];
    symbols.forEach(([label, latex]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.title = latex;
      button.setAttribute('aria-label', `Insert ${latex.slice(1)}`);
      button.addEventListener('click', () => {
        this.source.setRangeText(latex + ' ', this.source.selectionStart, this.source.selectionEnd, 'end');
        this.source.focus();
        this.updatePreview();
      });
      this.dialog.querySelector('.equation-symbols')!.append(button);
    });
    this.dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => this.dialog.close()));
    this.dialog.addEventListener('close', () => editor.focus());
    this.source.addEventListener('input', () => this.updatePreview());
    this.display.addEventListener('change', () => this.updatePreview());
    this.dialog.querySelector('#equationLabel')!.addEventListener('input', () => this.updatePreview());
    this.insert.addEventListener('click', () => this.commit());
    document.getElementById('markdownEditor')!.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('latex-mode')) return;
      const event = e as KeyboardEvent;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === 'e') { event.preventDefault(); this.open(); }
      else if (!event.shiftKey && ['b', 'i', 'k'].includes(key)) {
        event.preventDefault();
        formatSelection(editor, key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'link');
      }
    });
  }

  private open(): void {
    this.range = this.editor.getSelection();
    const locate = document.body.classList.contains('latex-mode') ? latexEquationAt : equationAt;
    const existing = locate(this.editor.getContent(), this.range.start, this.range.end);
    this.source.value = existing?.source ?? (this.editor.getSelectedText().trim() || 'f(x) = x^2');
    this.display.value = existing ? (existing.display ? 'display' : 'inline') : 'display';
    this.dialog.querySelector<HTMLInputElement>('#equationLabel')!.value = existing?.label ?? '';
    if (existing) this.range = { start: existing.start, end: existing.end };
    this.insert.textContent = existing ? 'Update equation' : 'Insert equation';
    this.updatePreview();
    this.dialog.showModal();
    this.source.focus();
    this.dialog.dispatchEvent(new Event('equation-open'));
  }

  private updatePreview(): void {
    try {
      if (!this.source.value.trim()) throw new Error('Enter an expression to preview.');
      const label = this.dialog.querySelector<HTMLInputElement>('#equationLabel')!;
      label.disabled = this.display.value === 'inline';
      if (!label.disabled && label.value && (!validLabel(label.value) || !label.value.startsWith('eq:'))) throw new Error('Use an equation label such as eq:energy (letters, numbers, hyphens, underscores).');
      if (/\\placeholder|#\?/.test(this.source.value)) throw new Error('Complete the empty boxes in the visual equation before inserting.');
      if (this.display.value === 'inline' && /\n/.test(this.source.value.trim())) {
        throw new Error('Inline equations must fit on one source line. Choose display placement for multiple lines.');
      }
      this.preview.innerHTML = katex.renderToString(this.source.value.trim(), { displayMode: this.display.value === 'display', throwOnError: true, trust: false, strict: false });
      this.error.textContent = '';
      this.insert.disabled = false;
    } catch (error) {
      this.preview.textContent = 'Your equation preview will appear here.';
      this.error.textContent = error instanceof Error ? error.message.replace(/^KaTeX parse error: /, '') : 'Check the expression.';
      this.insert.disabled = true;
    }
  }

  private commit(): void {
    if (this.insert.disabled) return;
    const source = this.source.value.trim();
    const content = this.editor.getContent();
    const { start, end } = this.range;
    let text = `$${source}$`;
    if (this.display.value === 'display') {
      const before = content.slice(0, start);
      const after = content.slice(end);
      const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      const label = this.dialog.querySelector<HTMLInputElement>('#equationLabel')!.value;
      text = document.body.classList.contains('latex-mode')
        ? prefix + '\\begin{equation}\n' + source + (label ? `\n\\label{${label}}` : '') + '\n\\end{equation}' + suffix
        : prefix + '$$\n' + source + '\n$$' + (label ? ` {#${label}}` : '') + suffix;
    }
    this.editor.replaceRange(start, end, text);
    this.dialog.close();
  }
}

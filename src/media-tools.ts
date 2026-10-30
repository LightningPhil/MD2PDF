import { marked, type Tokens } from 'marked';
import { MarkdownEditor } from './editor.js';
import { escapeHtml, validLabel } from './document.js';
import { makeDialog, showDialog, dialogError } from './dialog.js';

export interface TableData { start: number; end: number; cells: string[][]; align: string[]; caption: string; label: string }
export function tableAt(content: string, position: number): TableData | null {
  let offset = 0;
  const tokens = marked.lexer(content);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'table' && position >= offset && position <= offset + token.raw.length) {
      const table = token as Tokens.Table;
      const rest = content.slice(offset + token.raw.length);
      const caption = /^\s*: (.*?)\s*\{#(tab:[\w:-]+)\}(?:\n|$)/.exec(rest);
      const plain = (cell: Tokens.TableCell) => cell.text.replace(/\\\|/g, '|');
      return { start: offset, end: offset + token.raw.length + (caption?.[0].length ?? 0), cells: [table.header.map(plain), ...table.rows.map(row => row.map(plain))], align: table.align.map(a => a || 'left'), caption: caption?.[1] ?? '', label: caption?.[2] ?? '' };
    }
    offset += token.raw.length;
  }
  return null;
}
export function tableMarkdown(cells: string[][], align: string[], caption = '', label = ''): string {
  const row = (values: string[]) => '| ' + values.map(value => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ') + ' |';
  const separators = align.map(a => a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---');
  return [row(cells[0]), row(separators), ...cells.slice(1).map(row)].join('\n') + (label ? `\n\n: ${caption || 'Results'} {#${label}}` : '') + '\n\n';
}
export class MediaTools {
  private tableDialog: HTMLDialogElement;
  private table: TableData = { start: 0, end: 0, cells: [], align: [], caption: '', label: '' };
  private imageDialog: HTMLDialogElement;
  private imageRange = { start: 0, end: 0 };
  private imageWidth = 0;
  private imageHeight = 0;
  constructor(private editor: MarkdownEditor) {
    const table = makeDialog('Table editor', `<p class="tool-help">The first row contains column headings. Edit cells directly and choose each column’s alignment.</p><div class="table-grid-scroll"><table id="tableGrid"></table></div><div class="tool-inline"><button type="button" id="addTableRow">Add row</button><button type="button" id="addTableColumn">Add column</button></div><label>Caption<input id="tableCaption" maxlength="300"></label><label>Reference label (optional)<input id="tableLabel" placeholder="tab:results"></label><p class="tool-help">Add a label to number this table and reference it elsewhere.</p>`, 'Insert table');
    this.tableDialog = table.dialog;
    table.form.addEventListener('submit', event => {
      event.preventDefault();
      const label = table.dialog.querySelector<HTMLInputElement>('#tableLabel')!.value.trim();
      if (label && (!validLabel(label) || !label.startsWith('tab:'))) { dialogError(table.dialog, 'Use a table label such as tab:results.'); return; }
      const caption = table.dialog.querySelector<HTMLInputElement>('#tableCaption')!.value;
      const prefix = this.table.start > 0 && !editor.getContent().slice(0, this.table.start).endsWith('\n\n') ? '\n\n' : '';
      editor.replaceRange(this.table.start, this.table.end, prefix + tableMarkdown(this.table.cells, this.table.align, caption, label));
      table.dialog.close(); editor.focus();
    });
    table.dialog.querySelector('#addTableRow')!.addEventListener('click', () => {
      if (this.table.cells.length >= 101) return;
      this.table.cells.push(this.table.align.map(() => '')); this.drawGrid();
    });
    table.dialog.querySelector('#addTableColumn')!.addEventListener('click', () => {
      if (this.table.align.length >= 20) return;
      this.table.cells.forEach(row => row.push('')); this.table.align.push('left'); this.drawGrid();
    });
    const image = makeDialog('Image & caption', `<label>Choose an image<input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><label>Or image URL<input id="imageSource" placeholder="https://…" aria-describedby="imageUrlHelp"></label><p id="imageUrlHelp" class="tool-help">Pasted and uploaded images are embedded and included in portable packages. Remote image URLs require a connection.</p><img id="imagePreview" alt="Image preview" hidden><label>Alternative text<input id="imageAlt" maxlength="500" required placeholder="Describe what the image shows"></label><div class="tool-grid"><label>Width (% of page)<input id="imageSize" type="number" min="10" max="100" value="100"></label><label>Reference label (optional)<input id="imageLabel" placeholder="fig:diagram"></label></div><label>Caption<input id="imageCaption" maxlength="500"></label>`, 'Insert image');
    this.imageDialog = image.dialog;
    image.dialog.querySelector('#imageFile')!.addEventListener('change', () => {
      const file = image.dialog.querySelector<HTMLInputElement>('#imageFile')!.files?.[0];
      if (file) void this.loadImage(file);
    });
    image.dialog.querySelector('#imageSource')!.addEventListener('input', () => this.previewImage());
    image.form.addEventListener('submit', event => {
      event.preventDefault();
      const value = (id: string) => image.dialog.querySelector<HTMLInputElement>(`#${id}`)!.value.trim();
      const src = value('imageSource');
      const label = value('imageLabel');
      if (!/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(src)) { dialogError(image.dialog, 'Choose an image file or enter an http/https image URL.'); return; }
      if (label && (!validLabel(label) || !label.startsWith('fig:'))) { dialogError(image.dialog, 'Use a figure label such as fig:diagram.'); return; }
      const width = Math.min(100, Math.max(10, Number(value('imageSize')) || 100));
      const dimensions = this.imageWidth && this.imageHeight ? ` width="${this.imageWidth}" height="${this.imageHeight}"` : '';
      const html = `<figure${label ? ` data-label="${label}"` : ''}><img src="${escapeHtml(src)}" alt="${escapeHtml(value('imageAlt'))}"${dimensions} style="width:${width}%;height:auto">${value('imageCaption') ? `<figcaption>${escapeHtml(value('imageCaption'))}</figcaption>` : ''}</figure>`;
      const before = editor.getContent().slice(0, this.imageRange.start);
      editor.replaceRange(this.imageRange.start, this.imageRange.end, (before && !before.endsWith('\n\n') ? '\n\n' : '') + html + '\n\n');
      image.dialog.close(); editor.focus();
    });
    const textarea = document.getElementById('markdownEditor')!;
    textarea.addEventListener('paste', event => {
      const paste = event as ClipboardEvent;
      const file = Array.from(paste.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
      if (file) { event.preventDefault(); this.openImage(); void this.loadImage(file); }
    });
    textarea.addEventListener('drop', event => {
      const drop = event as DragEvent;
      const file = Array.from(drop.dataTransfer?.files ?? []).find(f => f.type.startsWith('image/'));
      if (file) { event.preventDefault(); event.stopPropagation(); this.openImage(); void this.loadImage(file); }
    });
    // Upgrade the original toolbar table button to the visual editor.
    const old = document.querySelector('[data-format="table"]');
    if (old) {
      const replacement = old.cloneNode(true) as HTMLButtonElement;
      old.replaceWith(replacement); replacement.title = 'Insert or edit table';
      replacement.addEventListener('mousedown', event => event.preventDefault());
      replacement.addEventListener('click', () => this.openTable());
    }
  }
  openTable(): void {
    const selection = this.editor.getSelection();
    const existing = tableAt(this.editor.getContent(), selection.start);
    this.table = existing ?? { ...selection, cells: [['Column 1', 'Column 2'], ['', '']], align: ['left', 'left'], caption: '', label: '' };
    this.tableDialog.querySelector<HTMLInputElement>('#tableCaption')!.value = this.table.caption;
    this.tableDialog.querySelector<HTMLInputElement>('#tableLabel')!.value = this.table.label;
    this.tableDialog.querySelector('[type="submit"]')!.textContent = existing ? 'Update table' : 'Insert table';
    this.drawGrid(); showDialog(this.tableDialog);
  }
  openImage(): void {
    const content = this.editor.getContent();
    this.imageRange = this.editor.getSelection();
    let source = '', alt = '', caption = '', label = '', size = '100';
    for (const match of content.matchAll(/<figure\b[\s\S]*?<\/figure>/gi)) {
      if (this.imageRange.start < match.index! || this.imageRange.start > match.index! + match[0].length) continue;
      const parsed = new DOMParser().parseFromString(match[0], 'text/html');
      const image = parsed.querySelector('img');
      if (!image) continue;
      this.imageRange = { start: match.index!, end: match.index! + match[0].length };
      source = image.getAttribute('src') || ''; alt = image.alt; caption = parsed.querySelector('figcaption')?.textContent || '';
      label = parsed.querySelector('figure')?.dataset.label || '';
      size = image.style.width.replace('%', '') || '100';
      break;
    }
    if (!source) {
      let offset = 0;
      for (const token of marked.lexer(content)) {
        if (token.type === 'paragraph' && this.imageRange.start >= offset && this.imageRange.start <= offset + token.raw.length) {
          const image = (token as Tokens.Paragraph).tokens.find(t => t.type === 'image') as Tokens.Image | undefined;
          if (image) {
            const start = offset + token.raw.indexOf(image.raw);
            this.imageRange = { start, end: start + image.raw.length }; source = image.href; alt = image.text; caption = image.title || '';
          }
        }
        offset += token.raw.length;
      }
    }
    for (const [id, value] of Object.entries({ imageSource: source, imageAlt: alt, imageCaption: caption, imageLabel: label, imageSize: size, imageFile: '' })) this.imageDialog.querySelector<HTMLInputElement>(`#${id}`)!.value = value;
    this.imageWidth = 0; this.imageHeight = 0;
    this.imageDialog.querySelector('[type="submit"]')!.textContent = source ? 'Update image' : 'Insert image';
    showDialog(this.imageDialog); this.previewImage();
  }
  private drawGrid(): void {
    const grid = this.tableDialog.querySelector('#tableGrid')!;
    grid.replaceChildren();
    const alignRow = document.createElement('tr');
    this.table.align.forEach((alignment, column) => {
      const cell = document.createElement('th');
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Column ${column + 1} alignment`);
      for (const value of ['left', 'center', 'right']) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); }
      select.value = alignment; select.addEventListener('change', () => { this.table.align[column] = select.value; });
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = `Remove column ${column + 1}`; remove.disabled = this.table.align.length <= 1;
      remove.addEventListener('click', () => { this.table.align.splice(column, 1); this.table.cells.forEach(row => row.splice(column, 1)); this.drawGrid(); });
      cell.append(select, remove); alignRow.append(cell);
    });
    grid.append(alignRow);
    this.table.cells.forEach((values, row) => {
      const tr = document.createElement('tr');
      values.forEach((value, column) => {
        const cell = document.createElement(row === 0 ? 'th' : 'td');
        const input = document.createElement('input'); input.value = value;
        input.setAttribute('aria-label', `${row === 0 ? 'Heading' : `Row ${row}`} column ${column + 1}`);
        input.addEventListener('input', () => { this.table.cells[row][column] = input.value; });
        cell.append(input); tr.append(cell);
      });
      if (row > 0) {
        const cell = document.createElement('td'); const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.title = `Remove row ${row}`;
        remove.addEventListener('click', () => { this.table.cells.splice(row, 1); this.drawGrid(); }); cell.append(remove); tr.append(cell);
      }
      grid.append(tr);
    });
  }
  private async loadImage(file: File): Promise<void> {
    try {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file);
      });
      this.imageDialog.querySelector<HTMLInputElement>('#imageSource')!.value = src;
      this.imageDialog.querySelector<HTMLInputElement>('#imageAlt')!.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      this.previewImage();
    } catch (error) { dialogError(this.imageDialog, error instanceof Error ? error.message : 'Could not load image.'); }
  }
  private previewImage(): void {
    const image = this.imageDialog.querySelector<HTMLImageElement>('#imagePreview')!;
    const src = this.imageDialog.querySelector<HTMLInputElement>('#imageSource')!.value;
    image.hidden = !src;
    this.imageWidth = 0; this.imageHeight = 0;
    image.onload = () => { this.imageWidth = image.naturalWidth; this.imageHeight = image.naturalHeight; };
    image.onerror = () => dialogError(this.imageDialog, 'Image could not load. Check the URL or choose a local file.');
    if (/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(src)) image.src = src;
    else { image.removeAttribute('src'); image.hidden = true; }
  }
}

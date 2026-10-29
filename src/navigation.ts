import { MarkdownEditor } from './editor.js';

/** Measure a source offset in the textarea, including soft-wrapped lines. */
export function sourceOffsetY(textarea: HTMLTextAreaElement, offset: number): number {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  mirror.style.cssText = `position:fixed;left:-100000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${textarea.clientWidth}px;font:${style.font};line-height:${style.lineHeight};padding:${style.padding};border:0;tab-size:${style.tabSize};`;
  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement('span'); marker.textContent = '\u200b'; mirror.append(marker);
  document.body.append(mirror);
  const y = marker.offsetTop;
  mirror.remove();
  return y;
}
export class DocumentNavigation {
  syncEnabled = true;
  private textarea = document.getElementById('markdownEditor') as HTMLTextAreaElement;
  private preview = document.getElementById('previewContainer')!;
  private viewport = document.getElementById('previewViewport')!;
  private lockUntil = 0;
  private frame = 0;
  private findPanel: HTMLElement;
  private matches: number[] = [];
  private matchIndex = -1;
  private positionCache = new Map<number, number>();
  constructor(private editor: MarkdownEditor, private onEquation: () => void, private onImage: () => void, private onTable: () => void) {
    const panel = document.createElement('div'); panel.className = 'find-panel'; panel.hidden = true;
    panel.innerHTML = `<div class="tool-inline"><label>Find<input id="findText" type="search" autocomplete="off"></label><label>Replace<input id="replaceText" autocomplete="off"></label><label class="check-label"><input id="findCase" type="checkbox">Match case</label></div><div class="tool-inline"><span id="findCount" role="status" aria-live="polite"></span><button type="button" id="findPrevious">Previous</button><button type="button" id="findNext">Next</button><button type="button" id="replaceOne">Replace</button><button type="button" id="replaceAll">Replace all</button><button type="button" id="closeFind" aria-label="Close find and replace">×</button></div>`;
    this.findPanel = panel;
    this.textarea.before(panel);
    for (const id of ['findText', 'findCase']) panel.querySelector(`#${id}`)!.addEventListener(id === 'findCase' ? 'change' : 'input', () => { this.matchIndex = -1; this.updateMatches(); this.find(1); });
    panel.querySelector('#findNext')!.addEventListener('click', () => this.find(1));
    panel.querySelector('#findPrevious')!.addEventListener('click', () => this.find(-1));
    panel.querySelector('#replaceOne')!.addEventListener('click', () => {
      if (this.matchIndex < 0 || !this.matches.length) { this.find(1); return; }
      const start = this.matches[this.matchIndex];
      const value = panel.querySelector<HTMLInputElement>('#replaceText')!.value;
      const query = panel.querySelector<HTMLInputElement>('#findText')!.value;
      this.editor.replaceRange(start, start + query.length, value);
      this.updateMatches(); this.matchIndex = this.matches.findIndex(offset => offset >= start + value.length) - 1; this.find(1);
    });
    panel.querySelector('#replaceAll')!.addEventListener('click', () => {
      this.updateMatches();
      const query = panel.querySelector<HTMLInputElement>('#findText')!.value;
      if (!query || !this.matches.length) return;
      const replacement = panel.querySelector<HTMLInputElement>('#replaceText')!.value;
      let text = editor.getContent();
      for (const start of [...this.matches].reverse()) text = text.slice(0, start) + replacement + text.slice(start + query.length);
      editor.replaceRange(0, editor.getContent().length, text);
      this.matchIndex = -1; this.updateMatches();
    });
    panel.querySelector('#closeFind')!.addEventListener('click', () => { panel.hidden = true; editor.focus(); });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); panel.hidden = true; editor.focus(); }
      if (event.key === 'Enter') { event.preventDefault(); this.find(event.shiftKey ? -1 : 1); }
    });
    this.textarea.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['f', 'h'].includes(event.key.toLowerCase())) { event.preventDefault(); this.openFind(); }
      if (event.key === 'Escape' && document.body.classList.contains('focus-mode')) document.getElementById('focusWriting')?.click();
    });
    for (const type of ['click', 'keyup', 'select']) this.textarea.addEventListener(type, () => this.highlight(true));
    this.textarea.addEventListener('scroll', () => this.schedule(() => this.syncFromEditor()));
    this.viewport.addEventListener('scroll', () => this.schedule(() => this.syncFromPreview()));
    this.preview.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (anchor) {
        const destination = Array.from(this.preview.querySelectorAll<HTMLElement>('[id]')).find(el => el.id === anchor.hash.slice(1));
        if (destination) { event.preventDefault(); destination.scrollIntoView({ block: 'start' }); }
        return;
      }
      const element = target.closest<HTMLElement>('[data-source-start]');
      if (!element) return;
      const start = Number(element.dataset.sourceStart);
      this.goTo(start, Number(element.dataset.sourceEnd), false);
      if (target.closest('.rendered-equation, .equation-block')) this.onEquation();
      else if (target.closest('img')) this.onImage();
      else if ((event as MouseEvent).detail >= 2 && target.closest('table')) this.onTable();
    });
    window.addEventListener('resize', () => this.positionCache.clear());
  }
  refresh(): void {
    this.positionCache.clear();
    const outline = document.getElementById('documentOutline');
    if (outline) {
      outline.replaceChildren();
      this.preview.querySelectorAll<HTMLElement>('h1[data-source-start],h2[data-source-start],h3[data-source-start],h4[data-source-start],h5[data-source-start],h6[data-source-start]').forEach(heading => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = heading.textContent; button.title = heading.textContent || '';
        button.style.paddingLeft = `${12 + (Number(heading.tagName[1]) - 1) * 10}px`;
        button.addEventListener('click', () => { this.goTo(Number(heading.dataset.sourceStart)); heading.scrollIntoView({ block: 'start' }); });
        outline.append(button);
      });
      if (!outline.children.length) outline.textContent = 'Headings will appear here.';
    }
    this.highlight(false);
    if (!this.findPanel.hidden) this.updateMatches();
  }
  openFind(): void {
    this.findPanel.hidden = false;
    const input = this.findPanel.querySelector<HTMLInputElement>('#findText')!;
    const selected = this.editor.getSelectedText();
    if (selected && !selected.includes('\n')) input.value = selected;
    this.matchIndex = -1; this.updateMatches(); input.focus(); input.select();
  }
  goTo(start: number, end = start, scrollPreview = true): void {
    this.editor.setSelection(start, end); this.editor.focus();
    this.lockUntil = performance.now() + 150;
    this.textarea.scrollTop = Math.max(0, this.measureOffset(start) - this.textarea.clientHeight / 3);
    this.highlight(scrollPreview);
  }
  private mappedBlocks(): HTMLElement[] {
    return Array.from(this.preview.querySelectorAll<HTMLElement>('.page-content > [data-source-start]'));
  }
  private measureOffset(offset: number): number {
    if (!this.positionCache.has(offset)) this.positionCache.set(offset, sourceOffsetY(this.textarea, offset));
    return this.positionCache.get(offset)!;
  }
  private highlight(scroll: boolean): void {
    const start = this.editor.getSelection().start;
    const blocks = this.mappedBlocks();
    const active = blocks.find(block => start >= Number(block.dataset.sourceStart) && start < Number(block.dataset.sourceEnd))
      ?? [...blocks].reverse().find(block => Number(block.dataset.sourceStart) <= start) ?? blocks[0];
    this.preview.querySelectorAll('.editing-block').forEach(el => el.classList.remove('editing-block'));
    active?.classList.add('editing-block');
    if (scroll && this.syncEnabled && active) { this.lockUntil = performance.now() + 150; active.scrollIntoView({ block: 'nearest' }); }
  }
  private schedule(action: () => void): void {
    cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(action);
  }
  private syncFromEditor(): void {
    if (!this.syncEnabled || performance.now() < this.lockUntil || !this.textarea.clientHeight) return;
    const blocks = this.mappedBlocks();
    if (!blocks.length) return;
    const sourcePositions = blocks.map(block => this.measureOffset(Number(block.dataset.sourceStart)));
    const next = sourcePositions.findIndex(y => y > this.textarea.scrollTop);
    const i = next < 0 ? blocks.length - 1 : Math.max(0, next - 1);
    const block = blocks[i];
    const fraction = Math.min(1, Math.max(0, (this.textarea.scrollTop - sourcePositions[i]) / Math.max(1, (sourcePositions[i + 1] ?? this.textarea.scrollHeight) - sourcePositions[i])));
    const view = this.viewport.getBoundingClientRect();
    const rect = block.getBoundingClientRect();
    this.lockUntil = performance.now() + 150;
    this.viewport.scrollTop += rect.top - view.top - 60 + fraction * rect.height;
  }
  private syncFromPreview(): void {
    if (!this.syncEnabled || performance.now() < this.lockUntil) return;
    const top = this.viewport.getBoundingClientRect().top + 60;
    const blocks = this.mappedBlocks();
    const block = blocks.find(b => b.getBoundingClientRect().bottom >= top) ?? blocks[blocks.length - 1];
    if (!block) return;
    const rect = block.getBoundingClientRect();
    const start = Number(block.dataset.sourceStart), end = Number(block.dataset.sourceEnd);
    const fraction = Math.max(0, Math.min(1, (top - rect.top) / Math.max(1, rect.height)));
    const y = this.measureOffset(start) + fraction * (this.measureOffset(end) - this.measureOffset(start));
    this.lockUntil = performance.now() + 150; this.textarea.scrollTop = y;
  }
  private updateMatches(): void {
    const query = this.findPanel.querySelector<HTMLInputElement>('#findText')!.value;
    const sensitive = this.findPanel.querySelector<HTMLInputElement>('#findCase')!.checked;
    let content = this.editor.getContent(), needle = query;
    if (!sensitive) { content = content.toLowerCase(); needle = needle.toLowerCase(); }
    this.matches = [];
    if (needle) for (let offset = content.indexOf(needle); offset >= 0; offset = content.indexOf(needle, offset + needle.length)) this.matches.push(offset);
    this.findPanel.querySelector('#findCount')!.textContent = `${this.matches.length} match${this.matches.length === 1 ? '' : 'es'}`;
  }
  private find(direction: number): void {
    this.updateMatches(); if (!this.matches.length) return;
    this.matchIndex = (this.matchIndex + direction + this.matches.length) % this.matches.length;
    const start = this.matches[this.matchIndex];
    const query = this.findPanel.querySelector<HTMLInputElement>('#findText')!.value;
    const focused = document.activeElement as HTMLElement;
    this.goTo(start, start + query.length); focused.focus();
    this.findPanel.querySelector('#findCount')!.textContent = `${this.matchIndex + 1} of ${this.matches.length}`;
  }
}

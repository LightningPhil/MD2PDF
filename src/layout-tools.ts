import { DEFAULT_SETTINGS, PRESETS, normalizeSettings, type DocumentSettings, type Preset } from './document.js';
import { makeDialog, showDialog, dialogError } from './dialog.js';

export class LayoutTools {
  private dialog: HTMLDialogElement;
  private form: HTMLFormElement;
  private presets: Record<string, DocumentSettings> = Object.create(null);
  constructor(private getSettings: () => DocumentSettings, private setSettings: (settings: DocumentSettings) => void) {
    const { dialog, form } = makeDialog('Document style & layout', `
      <label>Style preset<select name="preset"><option value="simple">Simple document</option><option value="technical">Technical report</option><option value="academic">Academic</option><option value="notes">Study notes</option></select></label>
      <div class="tool-grid"><label>Body font<select name="fontFamily"><option value="serif">Serif</option><option value="sans">Sans serif</option></select></label><label>Heading font<select name="headingFamily"><option value="serif">Serif</option><option value="sans">Sans serif</option></select></label>
      <label>Font size (px)<input type="number" name="fontSize" min="10" max="20" step="1"></label><label>Line spacing<input type="number" name="lineHeight" min="1.2" max="2.2" step="0.05"></label>
      <label>Paragraph spacing (em)<input type="number" name="spacing" min="0.5" max="1.8" step="0.05"></label><label>Margin (mm)<input type="number" name="margin" min="15" max="30" step="0.1"></label>
      <label>Paper<select name="pageSize"><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="tabloid">Tabloid</option><option value="a3">A3</option></select></label><label>Accent colour<input type="color" name="accent"></label></div>
      <fieldset><legend>Navigation & numbering</legend><label class="check-label"><input type="checkbox" name="toc"> Generate a linked table of contents</label><label class="check-label"><input type="checkbox" name="numberEquations"> Number display equations automatically</label><label>Page numbers<select name="pageNumbers"><option value="none">None</option><option value="number">1, 2, 3…</option><option value="total">Page 1 of 8</option></select></label></fieldset>
      <fieldset><legend>Title page</legend><label class="check-label"><input type="checkbox" name="titlePage"> Include a separate title page</label><label>Title<input name="title" maxlength="500"></label><label>Subtitle<input name="subtitle" maxlength="500"></label><div class="tool-grid"><label>Author<input name="author" maxlength="500"></label><label>Date<input name="date" maxlength="500" placeholder="Optional"></label></div></fieldset>
      <fieldset><legend>Running text</legend><label>Header<input name="header" maxlength="500"></label><label>Footer<input name="footer" maxlength="500"></label><p class="tool-help">Use {page} and {pages} for the current and total page counts.</p></fieldset>
      <fieldset><legend>Your presets</legend><div class="tool-inline"><label>Preset name<input name="presetName" maxlength="80" placeholder="My report style"></label><button type="button" id="saveStylePreset">Save preset</button><button type="button" id="deleteStylePreset">Delete selected preset</button></div></fieldset>`, 'Apply to document');
    this.dialog = dialog; this.form = form;
    try {
      const saved = JSON.parse(localStorage.getItem('md2pdf.style-presets') || '{}');
      for (const [key, value] of Object.entries(saved)) if (key.length <= 80) this.presets[key] = normalizeSettings(value);
    } catch { /* Start with built-in presets. */ }
    this.refreshPresetOptions();
    this.input<HTMLSelectElement>('preset').addEventListener('change', () => {
      const selected = this.input<HTMLSelectElement>('preset').value;
      if (selected.startsWith('saved:')) this.fill(this.presets[selected.slice(6)]);
      else if (selected in PRESETS) this.fill({ ...this.read(), ...PRESETS[selected as Exclude<Preset, 'custom'>], preset: selected as Preset });
      this.input<HTMLSelectElement>('preset').value = selected;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      this.setSettings(this.read());
      dialog.close();
    });
    dialog.querySelector('#saveStylePreset')!.addEventListener('click', () => {
      const name = this.input<HTMLInputElement>('presetName').value.trim();
      if (!name) { dialogError(dialog, 'Enter a name for your preset.'); return; }
      this.presets[name] = this.read();
      this.persistPresets();
      this.refreshPresetOptions();
      this.input<HTMLSelectElement>('preset').value = `saved:${name}`;
    });
    dialog.querySelector('#deleteStylePreset')!.addEventListener('click', () => {
      const key = this.input<HTMLSelectElement>('preset').value;
      if (!key.startsWith('saved:')) { dialogError(dialog, 'Select one of your saved presets first.'); return; }
      delete this.presets[key.slice(6)]; this.persistPresets(); this.refreshPresetOptions();
    });
  }
  open(): void { this.fill(this.getSettings()); showDialog(this.dialog); }
  private input<T extends HTMLInputElement | HTMLSelectElement>(name: string): T { return this.form.elements.namedItem(name) as T; }
  private fill(settings: DocumentSettings): void {
    for (const [key, value] of Object.entries(settings)) {
      const element = this.input<HTMLInputElement | HTMLSelectElement>(key);
      if (!element) continue;
      if (element instanceof HTMLInputElement && element.type === 'checkbox') element.checked = value === true;
      else element.value = String(value);
    }
    if (!this.input<HTMLSelectElement>('preset').value) this.input<HTMLSelectElement>('preset').value = 'custom';
  }
  private read(): DocumentSettings {
    const raw: Record<string, unknown> = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const element = this.input<HTMLInputElement | HTMLSelectElement>(key);
      raw[key] = typeof defaultValue === 'boolean' ? (element as HTMLInputElement).checked : typeof defaultValue === 'number' ? Number(element.value) : element.value;
    }
    if (!(String(raw.preset) in PRESETS)) raw.preset = 'custom';
    return normalizeSettings(raw);
  }
  private refreshPresetOptions(): void {
    const select = this.input<HTMLSelectElement>('preset');
    select.querySelectorAll('[data-custom]').forEach(option => option.remove());
    for (const name of Object.keys(this.presets)) {
      const option = document.createElement('option'); option.value = `saved:${name}`; option.textContent = name; option.dataset.custom = 'true'; select.append(option);
    }
    if (!select.querySelector('[value="custom"]')) { const option = document.createElement('option'); option.value = 'custom'; option.textContent = 'Custom settings'; select.append(option); }
  }
  private persistPresets(): void {
    try { localStorage.setItem('md2pdf.style-presets', JSON.stringify(this.presets)); dialogError(this.dialog, 'Saved your presets locally.'); }
    catch { dialogError(this.dialog, 'Could not save presets. Browser storage may be full or disabled.'); }
  }
}

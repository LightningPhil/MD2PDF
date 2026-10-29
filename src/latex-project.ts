import JSZip from 'jszip';
import { makeDialog, showDialog, downloadBlob } from './dialog.js';
export interface ProjectFile { path: string; content: string; encoding: 'utf8' | 'base64' }
export interface LatexProject { root: string; main: string; engine: 'pdflatex' | 'xelatex' | 'lualatex'; bibliography: 'auto' | 'bibtex' | 'biber' | 'off'; index: boolean; files: ProjectFile[] }
export const defaultProject = (): LatexProject => ({ root: 'main.tex', main: 'main.tex', engine: 'pdflatex', bibliography: 'auto', index: true, files: [] });
export interface ProjectHooks { get(): LatexProject; set(project: LatexProject): void; import(source: string, project: LatexProject): void }
export function projectPath(value: string): string {
  if (!value || value.length > 200 || value.includes('\\') || value.split('/').some(p => !p || p === '.' || p === '..' || /[<>:"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p))) throw new Error('Use a relative path such as chapters/introduction.tex.');
  if (!/\.(tex|bib|bst|sty|cls|png|jpg|jpeg|pdf|eps|ttf|otf|ist|bbx|cbx|lbx|def|cfg|csv|txt|md|dat)$/i.test(value)) throw new Error('Unsupported project file type.');
  return value;
}
const textFile = (name: string) => /\.(tex|bib|bst|sty|cls|ist|bbx|cbx|lbx|def|cfg|csv|txt|md|dat|eps)$/i.test(name);
export async function readLatexZip(file: Blob): Promise<{ source: string; project: LatexProject }> {
  if (file.size > 50 * 1024 * 1024) throw new Error('Project ZIP exceeds 50 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file('md2pdf-latex.json');
  const metadata = entry ? JSON.parse(await entry.async('string')) : {};
  const files: ProjectFile[] = []; let total = 0;
  for (const item of Object.values(zip.files)) {
    if (item.dir || item.name === 'md2pdf-latex.json' || /(?:^|\/)__MACOSX\//.test(item.name) || /(?:^|\/)\.DS_Store$|\.(?:aux|log|toc|out|bcf|bbl|blg|idx|ind|ilg|run\.xml|synctex(?:\.gz)?)$/i.test(item.name)) continue;
    const original = (item as typeof item & { unsafeOriginalName?: string }).unsafeOriginalName || item.name;
    projectPath(original);
    if (files.length >= 200) throw new Error('Projects support up to 200 files.');
    const bytes = await item.async('uint8array'); total += bytes.length;
    if (total > 50 * 1024 * 1024) throw new Error('Expanded project exceeds 50 MB.');
    if (files.some(f => f.path.toLowerCase() === original.toLowerCase())) throw new Error(`Duplicate project path: ${original}`);
    files.push({ path: original, encoding: textFile(original) ? 'utf8' : 'base64', content: textFile(original) ? new TextDecoder().decode(bytes) : await item.async('base64') });
  }
  const root = metadata.root || files.find(f => /(^|\/)main\.tex$/i.test(f.path))?.path || files.find(f => f.path.endsWith('.tex') && f.content.includes('\\documentclass'))?.path;
  const primary = files.find(f => f.path === root && /\.tex$/i.test(f.path) && f.encoding === 'utf8');
  if (!primary) throw new Error('ZIP must contain a main .tex document.');
  const project = { ...defaultProject(), ...metadata, root, files: files.filter(f => f !== primary) } as LatexProject;
  project.main = metadata.main || root;
  if (![root, ...project.files.map(f => f.path)].includes(project.main)) throw new Error('The selected main file is missing.');
  if (!['pdflatex', 'xelatex', 'lualatex'].includes(project.engine) || !['auto', 'bibtex', 'biber', 'off'].includes(project.bibliography)) throw new Error('Invalid project build settings.');
  return { source: primary.content, project };
}
export async function writeLatexZip(source: string, project: LatexProject): Promise<Blob> {
  const zip = new JSZip(); zip.file(project.root, source);
  project.files.forEach(f => zip.file(f.path, f.content, { base64: f.encoding === 'base64' }));
  const { files: _files, ...settings } = project;
  zip.file('md2pdf-latex.json', JSON.stringify(settings, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export class ProjectTools {
  private dialog: HTMLDialogElement;
  private list: HTMLSelectElement;
  private content: HTMLTextAreaElement;
  private message: HTMLElement;
  private selected = '';
  constructor(private hooks: ProjectHooks, private source: () => string, parent: HTMLElement, forward: (file: string, line: number) => Promise<void>) {
    const { dialog, form } = makeDialog('LaTeX project files', `<p>The primary source is edited in the main editor. Supporting text files save as you type; assets keep their relative paths.</p><label>Build main file <select id="projectMain"></select></label><label>Engine <select id="projectEngine"><option value="pdflatex">pdfLaTeX</option><option value="xelatex">XeLaTeX</option><option value="lualatex">LuaLaTeX</option></select></label><label>Bibliography <select id="projectBibliography"><option value="auto">Automatic</option><option value="bibtex">BibTeX</option><option value="biber">Biber</option><option value="off">Off</option></select></label><label><input type="checkbox" id="projectIndex"> Generate index (MakeIndex)</label><div class="project-actions"><label>Add files <input type="file" multiple id="projectUpload"></label><label>Add folder <input type="file" multiple webkitdirectory id="projectFolder"></label><label>Open project ZIP <input type="file" accept=".zip" id="projectZip"></label><button type="button" id="projectSaveZip">Save project ZIP</button></div><label>New file path <input id="projectNewPath" placeholder="chapters/introduction.tex"></label><button type="button" id="projectNewFile">Create text file</button><label>Project files <select id="projectFiles" size="5"></select></label><textarea id="projectSource" spellcheck="false" rows="14" aria-label="Supporting file source"></textarea><div><button type="button" id="projectRemove">Remove selected file</button><button type="button" id="projectForward">Show cursor in PDF</button></div>`, 'Done');
    this.dialog = dialog; dialog.classList.add('latex-project-dialog');
    this.list = dialog.querySelector('#projectFiles')!; this.content = dialog.querySelector('#projectSource')!; this.message = dialog.querySelector('.tool-dialog-message')!;
    form.onsubmit = event => { event.preventDefault(); dialog.close(); };
    dialog.querySelectorAll('[data-cancel]').forEach(button => { if (button.textContent === 'Cancel') button.textContent = 'Close'; });
    const button = document.createElement('button'); button.id = 'latexProject'; button.textContent = 'Project files & build'; button.onclick = () => this.open(); parent.append(button);
    const select = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(id)!;
    for (const [id, key] of [['#projectMain', 'main'], ['#projectEngine', 'engine'], ['#projectBibliography', 'bibliography']] as const) select<HTMLSelectElement>(id).onchange = event => {
      const project = structuredClone(hooks.get()); (project[key] as string) = (event.target as HTMLSelectElement).value; hooks.set(project);
    };
    select<HTMLInputElement>('#projectIndex').onchange = event => { const p = structuredClone(hooks.get()); p.index = (event.target as HTMLInputElement).checked; hooks.set(p); };
    this.list.onchange = () => { this.selected = this.list.value; this.editSelected(); };
    this.content.oninput = () => { const p = structuredClone(hooks.get()); const f = p.files.find(f => f.path === this.selected); if (f && f.encoding === 'utf8') { f.content = this.content.value; hooks.set(p); } };
    select<HTMLButtonElement>('#projectNewFile').onclick = () => this.guard(async () => {
      const name = projectPath(select<HTMLInputElement>('#projectNewPath').value.trim());
      if (!textFile(name)) throw new Error('Upload binary assets using Add files.');
      this.addFiles([{ path: name, content: '', encoding: 'utf8' }]); this.selected = name; this.refresh();
    });
    for (const id of ['#projectUpload', '#projectFolder']) select<HTMLInputElement>(id).onchange = event => this.guard(async () => {
      const input = event.target as HTMLInputElement; const pending: ProjectFile[] = [];
      for (const file of Array.from(input.files || [])) {
        const name = projectPath(file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name);
        if (file.size > 20 * 1024 * 1024) throw new Error('Individual assets must be smaller than 20 MB.');
        const content = textFile(name) ? await file.text() : await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        pending.push({ path: name, content, encoding: textFile(name) ? 'utf8' : 'base64' });
      }
      if (id === '#projectFolder') {
        const primary = pending.find(f => /(^|\/)main\.tex$/i.test(f.path)) || pending.find(f => /\.tex$/i.test(f.path) && f.content.includes('\\documentclass'));
        if (primary) {
          hooks.import(primary.content, { ...defaultProject(), root: primary.path, main: primary.path, files: pending.filter(f => f !== primary) }); input.value = ''; dialog.close(); return;
        }
      }
      this.addFiles(pending); input.value = ''; this.refresh();
    });
    select<HTMLInputElement>('#projectZip').onchange = event => this.guard(async () => {
      const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
      const loaded = await readLatexZip(file); hooks.import(loaded.source, loaded.project); input.value = ''; dialog.close();
    });
    select<HTMLButtonElement>('#projectSaveZip').onclick = () => this.guard(async () => downloadBlob(await writeLatexZip(source(), hooks.get()), 'latex-project.zip'));
    select<HTMLButtonElement>('#projectRemove').onclick = () => {
      const p = structuredClone(hooks.get()); p.files = p.files.filter(f => f.path !== this.selected); if (p.main === this.selected) p.main = p.root;
      hooks.set(p); this.selected = ''; this.refresh();
    };
    select<HTMLButtonElement>('#projectForward').onclick = () => this.guard(async () => {
      const line = this.content.value.slice(0, this.content.selectionStart).split('\n').length;
      dialog.close(); await forward(this.selected, line);
    });
  }
  private guard(task: () => Promise<void>): void { void task().catch(e => { this.message.textContent = e.message; }); }
  private addFiles(files: ProjectFile[]): void {
    const p = structuredClone(this.hooks.get()); const names = new Set([p.root, ...p.files.map(f => f.path)].map(n => n.toLowerCase()));
    for (const file of files) { if (names.has(file.path.toLowerCase())) throw new Error(`File already exists: ${file.path}. Edit it or remove it before replacing.`); names.add(file.path.toLowerCase()); }
    if (p.files.length + files.length > 199 || JSON.stringify([...p.files, ...files]).length > 70_000_000) throw new Error('Project exceeds its file or size limit.');
    p.files.push(...files); this.hooks.set(p);
  }
  open(file?: string, line = 1): void {
    this.selected = file || this.selected; this.refresh(); showDialog(this.dialog);
    if (file) { const offset = this.content.value.split('\n').slice(0, line - 1).reduce((n, s) => n + s.length + 1, 0); this.content.focus(); this.content.setSelectionRange(offset, offset); this.content.scrollTop = Math.max(0, line - 4) * 21; }
  }
  private refresh(): void {
    const p = this.hooks.get(); const main = this.dialog.querySelector<HTMLSelectElement>('#projectMain')!; main.replaceChildren();
    for (const name of [p.root, ...p.files.filter(f => f.encoding === 'utf8' && /\.tex$/i.test(f.path)).map(f => f.path)]) main.add(new Option(name, name));
    main.value = p.main;
    this.dialog.querySelector<HTMLSelectElement>('#projectEngine')!.value = p.engine;
    this.dialog.querySelector<HTMLSelectElement>('#projectBibliography')!.value = p.bibliography;
    this.dialog.querySelector<HTMLInputElement>('#projectIndex')!.checked = p.index;
    this.list.replaceChildren(); this.list.add(new Option(`${p.root} (main editor)`, p.root));
    p.files.forEach(f => this.list.add(new Option(f.path + (f.encoding === 'base64' ? ' (asset)' : ''), f.path)));
    if (![p.root, ...p.files.map(f => f.path)].includes(this.selected)) this.selected = p.root;
    this.list.value = this.selected; this.editSelected();
  }
  private editSelected(): void {
    const p = this.hooks.get(); const file = p.files.find(f => f.path === this.selected);
    this.content.disabled = !file || file.encoding !== 'utf8'; this.content.value = file?.encoding === 'utf8' ? file.content : !file ? this.source() : 'Binary asset: ' + file.path;
    this.dialog.querySelector<HTMLButtonElement>('#projectRemove')!.disabled = !file;
    this.dialog.querySelector<HTMLButtonElement>('#projectForward')!.disabled = !file || file.encoding !== 'utf8';
  }
}

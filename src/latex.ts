import { ProjectTools, type LatexProject, type ProjectHooks } from './latex-project.js';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { MarkdownEditor } from './editor.js';

export const LATEX_STARTER = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage{amsmath,amssymb}
\title{My document}
\author{}
\date{\today}
\begin{document}
\maketitle
\tableofcontents
\section{Introduction}
Write your document here. Use \textbf{bold}, \emph{emphasis},
and inline mathematics such as $f(x)=x^2$.
\begin{equation}\label{eq:energy}
  E = mc^2
\end{equation}
Refer to Equation~\ref{eq:energy}.
\end{document}
`;
export const isLatex = (filename = ''): boolean => /\.tex$/i.test(filename);
export interface LatexResult { success: boolean; pdfBase64?: string; buildId?: string; steps?: string[]; log: string; diagnostics: { message: string; file?: string; line: number; severity: 'error' | 'warning' }[] }
export async function compileLatex(source: string, project?: LatexProject, keepBuild = false): Promise<LatexResult> {
  const response = await fetch('/api/latex/compile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, project, keepBuild }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'LaTeX compilation failed.');
  return result;
}

export class LatexWorkspace {
  private panel = document.createElement('div');
  private toolbar = document.createElement('div');
  private status = document.createElement('p');
  private frame = document.createElement('div');
  private errors = document.createElement('div');
  private log = document.createElement('pre');
  private mode = document.createElement('select');
  private projectTools: ProjectTools;
  private projectKey = '';
  private buildId = '';
  private current = '';
  private source = '';
  private revision = 0;
  constructor(private editor: MarkdownEditor, newDocument: (filename: string, content: string) => void, changeMode: (latex: boolean) => void, private projectHooks: ProjectHooks) {
    const modes = document.createElement('div'); modes.className = 'source-mode';
    const label = document.createElement('label'); label.textContent = 'Source format ';
    this.mode.title = 'Changes the source language without converting or replacing your text.'; this.mode.id = 'sourceFormat'; this.mode.innerHTML = '<option value="markdown">Markdown</option><option value="latex">LaTeX</option>';
    label.append(this.mode); modes.append(label);
    this.mode.addEventListener('change', () => changeMode(this.mode.value === 'latex'));
    const add = document.createElement('button'); add.textContent = 'New LaTeX document'; add.id = 'newLatexDocument';
    add.onclick = () => newDocument('Document.tex', LATEX_STARTER); modes.append(add);
    document.getElementById('formattingToolbar')!.before(modes, this.toolbar);
    this.toolbar.id = 'latexToolbar'; this.toolbar.className = 'formatting-toolbar';
    const snippets: [string, string, string][] = [
      ['Section', '\\section{', '}'], ['Subsection', '\\subsection{', '}'], ['Bold', '\\textbf{', '}'], ['Emphasis', '\\emph{', '}'],
      ['List', '\\begin{itemize}\n\\item ', '\n\\end{itemize}\n'], ['Numbered list', '\\begin{enumerate}\n\\item ', '\n\\end{enumerate}\n'],
      ['Equation', '\\begin{equation}\n', '\n\\end{equation}\n'], ['Align', '\\begin{align}\n', '\n\\end{align}\n'],
      ['Reference', '\\ref{', '}'], ['Citation', '\\cite{', '}'], ['Footnote', '\\footnote{', '}'],
      ['Table', '\\begin{tabular}{ll}\n', ' & Value \\\\\n\\hline\nItem & 1 \\\\\n\\end{tabular}\n'], ['Page break', '\\newpage\n', ''],
    ];
    snippets.forEach(([label, before, after]) => {
      const button = document.createElement('button'); button.textContent = label;
      button.onmousedown = event => event.preventDefault();
      button.onclick = () => { const { start, end } = editor.getSelection(); const selection = editor.getSelectedText(); editor.replaceRange(start, end, before + selection + after); editor.setSelection(start + before.length, start + before.length + selection.length); editor.focus(); };
      this.toolbar.append(button);
    });
    const visual = document.createElement('button'); visual.textContent = 'Visual equation'; visual.id = 'latexVisualEquation';
    visual.onclick = () => document.querySelector<HTMLButtonElement>('.equation-button')!.click(); this.toolbar.append(visual);
    this.projectTools = new ProjectTools(projectHooks, () => this.source, this.toolbar, (file, line) => this.forward(file, line));
    const forward = document.createElement('button'); forward.id = 'latexForward'; forward.textContent = 'Show cursor in PDF';
    forward.onclick = () => { const line = this.source.slice(0, this.editor.getSelection().start).split('\n').length; void this.forward(projectHooks.get().root, line); }; this.toolbar.append(forward);
    this.panel.id = 'latexPreview';
    const compile = document.createElement('button'); compile.id = 'compileLatex'; compile.textContent = 'Compile LaTeX'; compile.onclick = () => { void this.compile(); };
    this.status.setAttribute('role', 'status'); this.frame.setAttribute('aria-label', 'Compiled LaTeX PDF'); this.frame.className = 'latex-pdf-pages'; this.frame.hidden = true;
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Compiler log'; details.append(summary, this.log);
    const help = document.createElement('p'); help.className = 'tool-help'; help.textContent = 'Choose files, engine and bibliography settings in Project files & build. Compile with Ctrl+Enter. Show cursor in PDF uses SyncTeX; double-click the PDF to open the corresponding source line. Layout is controlled by your preamble';
    this.panel.append(compile, help, this.status, this.errors, details, this.frame);
    document.querySelector('.preview-pane')!.append(this.panel);
    document.getElementById('markdownEditor')!.addEventListener('keydown', event => { if ((event as KeyboardEvent).ctrlKey && (event as KeyboardEvent).key === 'Enter' && this.current) { event.preventDefault(); void this.compile(); } });
  }
  update(filename: string, source: string): void {
    const latex = isLatex(filename);
    document.body.classList.toggle('latex-mode', latex); this.mode.value = latex ? 'latex' : 'markdown';
    this.panel.hidden = !latex; this.toolbar.hidden = !latex;
    const projectKey = JSON.stringify(this.projectHooks.get());
    if (this.current !== filename || this.source !== source || this.projectKey !== projectKey) {
      this.buildId = '';
      this.projectKey = projectKey;
      this.revision++;
      this.status.textContent = latex ? 'Source changed. Compile to preview the current PDF.' : '';
      this.frame.hidden = true; this.errors.replaceChildren(); this.log.textContent = '';
      this.frame.replaceChildren();
    }
    this.current = latex ? filename : ''; this.source = source;
  }
  goToSource(file: string, line: number): void {
    const project = this.projectHooks.get();
    if (file === project.root) {
      const offset = this.source.split('\n').slice(0, line - 1).reduce((n, value) => n + value.length + 1, 0);
      this.editor.setSelection(offset, offset); this.editor.focus();
      (document.getElementById('markdownEditor') as HTMLTextAreaElement).scrollTop = Math.max(0, line - 5) * 21;
    } else if (project.files.some(f => f.path === file)) this.projectTools.open(file, line);
    else this.status.textContent = `Diagnostic refers to ${file}; see the compiler log.`;
  }
  private async synchronize(query: Record<string, unknown>): Promise<{ file: string; line: number; page: number; x: number; y: number }> {
    if (!this.buildId) throw new Error('Compile the current source before using SyncTeX.');
    const response = await fetch('/api/latex/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...query, buildId: this.buildId }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  private async forward(file: string, line: number): Promise<void> {
    try {
      const location = await this.synchronize({ direction: 'forward', file, line });
      const canvas = this.frame.querySelector<HTMLCanvasElement>(`[data-page="${location.page}"]`);
      if (!canvas) throw new Error('The matching PDF page is unavailable.');
      this.frame.querySelector('.synctex-marker')?.remove();
      const marker = document.createElement('span'); marker.className = 'synctex-marker'; marker.title = `${file}:${line}`;
      marker.style.left = `${Math.max(0, location.x * 1.5 / canvas.width * canvas.clientWidth)}px`;
      marker.style.top = `${canvas.offsetTop + location.y * 1.5 / canvas.height * canvas.clientHeight}px`;
      this.frame.append(marker); marker.scrollIntoView({ block: 'center', behavior: 'smooth' });
      this.frame.querySelectorAll('.synctex-target').forEach(el => el.classList.remove('synctex-target')); canvas.classList.add('synctex-target');
      this.status.textContent = `SyncTeX: ${file}, line ${line} → PDF page ${location.page}.`;
    } catch (error) { this.status.textContent = error instanceof Error ? error.message : 'SyncTeX failed.'; }
  }
  private async compile(): Promise<void> {
    if (!this.current) return;
    const revision = ++this.revision;
    this.status.textContent = `Compiling with ${this.projectHooks.get().engine}…`; this.errors.replaceChildren();
    try {
      const result = await compileLatex(this.source, this.projectHooks.get(), true);
      if (revision !== this.revision) return;
      this.buildId = result.buildId || '';
      this.log.textContent = result.log;
      this.status.textContent = result.success ? 'Rendering PDF…' : 'Compilation failed. Correct the source and compile again.';
      result.diagnostics.forEach(issue => {
        const button = document.createElement('button'); button.textContent = `${issue.file || this.projectHooks.get().root}:${issue.line}: ${issue.message}`;
        button.onclick = () => this.goToSource(issue.file || this.projectHooks.get().main, issue.line);
        this.errors.append(button);
      });
      if (result.success && result.pdfBase64) {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const bytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0));
        const loading = pdfjs.getDocument({ data: bytes });
        const pdf = await loading.promise;
        try {
          if (revision !== this.revision) return;
          this.frame.replaceChildren(); this.frame.hidden = false;
          for (let index = 1; index <= pdf.numPages; index++) {
            if (revision !== this.revision) return;
            const page = await pdf.getPage(index);
            if (revision !== this.revision) return;
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
            canvas.setAttribute('aria-label', `PDF page ${index} of ${pdf.numPages}`);
            canvas.dataset.page = String(index);
            canvas.ondblclick = event => {
              const rect = canvas.getBoundingClientRect();
              void this.synchronize({ direction: 'inverse', page: index, x: (event.clientX - rect.left) * viewport.width / rect.width / 1.5, y: (event.clientY - rect.top) * viewport.height / rect.height / 1.5 }).then(location => this.goToSource(location.file, location.line)).catch(error => { this.status.textContent = error.message; });
            };
            this.frame.append(canvas);
            await page.render({ canvas, viewport }).promise;
          }
          if (revision === this.revision) this.status.textContent = 'PDF is up to date.';
        } finally { await loading.destroy(); }
      }
    } catch (error) { if (revision === this.revision) this.status.textContent = error instanceof Error ? error.message : 'Compilation failed.'; }
  }
}

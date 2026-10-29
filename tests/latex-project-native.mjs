import { compileLatex, syncLatex, normalizeProject } from '../scripts/latex-compile.mjs';
import assert from 'node:assert/strict';
const project = { root: 'main.tex', main: 'main.tex', files: [
  { path: 'chapters/intro.tex', encoding: 'utf8', content: '\\section{Project test}\nIncluded text.\\index{Included text} Reference~\\cite{sample}.' },
  { path: 'references.bib', encoding: 'utf8', content: '@book{sample,author={Ada Example},title={Native Build Test},year={2024},publisher={Test Press}}' },
] };
const source = String.raw`\documentclass{article}
\usepackage{makeidx}\makeindex
\begin{document}
\input{chapters/intro}
\bibliographystyle{plain}\bibliography{references}
\printindex\end{document}`;
for (const engine of ['pdflatex', 'xelatex', 'lualatex']) {
  const result = await compileLatex(source, { ...project, engine }, true);
  assert.equal(result.success, true, result.log);
  assert.ok(result.steps.includes('bibtex')); assert.ok(result.steps.includes('makeindex'));
  assert.equal(result.diagnostics.filter(d => d.severity === 'error').length, 0);
  const location = await syncLatex({ buildId: result.buildId, direction: 'forward', file: 'chapters/intro.tex', line: 2 });
  assert.equal(location.page, 1);
  const inverse = await syncLatex({ buildId: result.buildId, direction: 'inverse', ...location });
  assert.equal(inverse.file, 'chapters/intro.tex'); assert.equal(inverse.line, 2);
  await assert.rejects(syncLatex({ buildId: result.buildId, direction: 'forward', file: '../outside.tex', line: 1 }));
  console.log(`${engine}: bibliography, index and two-way SyncTeX passed.`);
}
const biber = await compileLatex(String.raw`\documentclass{article}\usepackage{biblatex}\addbibresource{references.bib}\begin{document}Cite~\cite{sample}.\printbibliography\end{document}`, project);
assert.equal(biber.success, true, biber.log); assert.ok(biber.steps.includes('biber'));
assert.equal(biber.diagnostics.length, 0);
const broken = await compileLatex(source, { ...project, files: project.files.map(f => f.path.endsWith('intro.tex') ? { ...f, content: '\\unknowncommand' } : f) });
assert.equal(broken.success, false); assert.ok(broken.diagnostics.some(d => d.file === 'chapters/intro.tex'));
assert.throws(() => normalizeProject(source, { files: [{ path: '../escape.tex', content: '', encoding: 'utf8' }] }));
console.log('Biber, included-file diagnostics and invalid-path rejection passed.');

for (const engine of ['xelatex', 'lualatex']) {
  const unicode = await compileLatex(String.raw`\documentclass{article}\usepackage{fontspec}\setmainfont{Arial}\begin{document}Unicode café naïve Ω.\end{document}`, { engine });
  assert.equal(unicode.success, true, unicode.log);
  assert.equal(unicode.diagnostics.length, 0);
  console.log(`${engine}: Unicode and system-font compilation passed.`);
}

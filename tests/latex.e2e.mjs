import { build, preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { compileLatex } from '../scripts/latex-compile.mjs';

await mkdir('tmp/latex-tests', { recursive: true });
await build({ logLevel: 'error' });
const server = await preview({ preview: { host: '127.0.0.1', port: 4318, open: false } });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') console.log(message.text()); });
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  const editor = page.locator('#markdownEditor');
  await editor.fill('# Markdown document\n\nStill works.');
  await page.locator('#newLatexDocument').click();
  const source = await editor.inputValue();
  assert.equal(await page.locator('#sourceFormat').inputValue(), 'latex');
  await page.locator('#compileLatex').click();
  await page.getByText('PDF is up to date.', { exact: true }).waitFor({ timeout: 60000 });
  assert.ok(await page.locator('#latexPreview canvas').isVisible());
  await page.screenshot({ path: 'tmp/latex-tests/editor.png' });
  let downloadPromise = page.waitForEvent('download');
  await page.locator('#saveBtn').click();
  let download = await downloadPromise; assert.equal(download.suggestedFilename(), 'Document.tex');
  await download.saveAs('tmp/latex-tests/document.tex');
  assert.equal(await readFile('tmp/latex-tests/document.tex', 'utf8'), source);
  await page.locator('#sourceFormat').selectOption('markdown');
  assert.equal(await editor.inputValue(), source);
  await page.locator('#sourceFormat').selectOption('latex');
  await page.waitForTimeout(500); await page.reload();
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  assert.equal(await page.locator('#sourceFormat').inputValue(), 'latex');
  assert.equal(await editor.inputValue(), source);
  const invalid = source.replace('Write your document here.', '\\unknowncommand');
  await editor.fill(invalid); await page.locator('#compileLatex').click();
  await page.getByText('Compilation failed. Correct the source and compile again.').waitFor({ timeout: 60000 });
  await page.locator('#latexPreview > div button').first().click();
  assert.ok(await editor.evaluate(el => el.selectionStart > 0));
  assert.equal(await page.locator('#latexPreview canvas').isVisible(), false);
  await editor.fill(source);
  await page.locator('#exportPdfBtn').click();
  downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('#exportStartBtn').click(); download = await downloadPromise;
  await download.saveAs('tmp/latex-tests/export.pdf');
  assert.ok((await readFile('tmp/latex-tests/export.pdf')).subarray(0, 4).equals(Buffer.from('%PDF')));
  await page.locator('#exportDismissBtn').click();
  await page.locator('#exportPdfBtn').click(); await page.locator('#exportScopeAll').check();
  downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('#exportStartBtn').click(); download = await downloadPromise;
  await download.saveAs('tmp/latex-tests/mixed.zip');
  const zip = await JSZip.loadAsync(await readFile('tmp/latex-tests/mixed.zip'));
  assert.equal(Object.keys(zip.files).filter(name => name.endsWith('.pdf')).length, 2);
  await page.locator('#exportDismissBtn').click();
  await page.locator('#uploadFile').setInputFiles('tmp/latex-tests/document.tex');
  assert.equal(await page.locator('#sourceFormat').inputValue(), 'latex');
  assert.equal(await editor.inputValue(), source);
  const missing = await compileLatex('\\documentclass{article}\n\\usepackage{mdtwoPdfMissingPackage}\n\\begin{document}Test\\end{document}');
  assert.equal(missing.success, false); assert.match(missing.log, /not found/);
  await editor.fill(String.raw`\documentclass{article}
\usepackage{graphicx}
\usepackage{makeidx}
\makeindex
\begin{document}
\input{chapters/intro}
\bibliographystyle{plain}
\bibliography{references}
\printindex
\end{document}`);
  await page.locator('#latexProject').click();
  const projectDialog = page.getByRole('dialog', { name: 'LaTeX project files' });
  const addText = async (name, content) => {
    await page.locator('#projectNewPath').fill(name); await page.locator('#projectNewFile').click();
    await page.locator('#projectSource').fill(content);
  };
  await addText('chapters/intro.tex', String.raw`\section{Included chapter}
This text lives in a separate file.\index{Included chapter} Cite~\cite{sample}.
\includegraphics[width=10mm]{pixel.png}`);
  await addText('references.bib', '@book{sample,author={Ada Example},title={Project Bibliography},year={2024},publisher={Test Press}}');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d'); ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, 16, 16); return c.toDataURL().split(',')[1]; });
  await page.locator('#projectUpload').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.querySelector('#projectFiles').options.length === 4);
  await page.locator('#projectEngine').selectOption('xelatex');
  await projectDialog.getByRole('button', { name: 'Done', exact: true }).click();
  const compilation = page.waitForResponse(response => response.url().endsWith('/api/latex/compile'));
  await page.locator('#compileLatex').click();
  const built = await (await compilation).json(); assert.equal(built.success, true, built.log);
  assert.ok(built.steps.includes('bibtex')); assert.ok(built.steps.includes('makeindex')); assert.ok(built.steps.includes('xelatex'));
  await page.getByText('PDF is up to date.', { exact: true }).waitFor({ timeout: 60000 });
  assert.equal(await page.locator('#latexPreview canvas').count(), 2);
  await page.locator('#latexProject').click(); await page.locator('#projectFiles').selectOption('chapters/intro.tex');
  await page.locator('#projectSource').evaluate(el => el.setSelectionRange(el.value.indexOf('This text'), el.value.indexOf('This text')));
  await page.locator('#projectForward').click();
  await page.getByText('SyncTeX: chapters/intro.tex, line 2 → PDF page 1.', { exact: true }).waitFor();
  const location = await (await page.request.post(server.resolvedUrls.local[0] + 'api/latex/sync', { data: { buildId: built.buildId, direction: 'forward', file: 'chapters/intro.tex', line: 2 } })).json();
  const canvas = page.locator('#latexPreview canvas').first();
  const point = await canvas.evaluate((el, p) => ({ x: p.x * 1.5 * el.clientWidth / el.width, y: p.y * 1.5 * el.clientHeight / el.height }), location);
  await canvas.dblclick({ position: point });
  await projectDialog.waitFor(); assert.equal(await page.locator('#projectFiles').inputValue(), 'chapters/intro.tex');
  assert.ok(await page.locator('#projectSource').evaluate(el => el.selectionStart > 0));
  downloadPromise = page.waitForEvent('download'); await page.locator('#projectSaveZip').click(); download = await downloadPromise;
  await download.saveAs('tmp/latex-tests/project.zip');
  const projectZip = await JSZip.loadAsync(await readFile('tmp/latex-tests/project.zip'));
  assert.ok(projectZip.file('chapters/intro.tex')); assert.ok(projectZip.file('pixel.png'));
  await projectDialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.waitForTimeout(500); await page.reload();
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  await page.locator('#latexProject').click(); assert.equal(await page.locator('#projectEngine').inputValue(), 'xelatex');
  assert.equal(await page.locator('#projectFiles option').count(), 4);
  await page.locator('#projectZip').setInputFiles('tmp/latex-tests/project.zip');
  await projectDialog.waitFor({ state: 'hidden' });
  await page.locator('#exportPdfBtn').click();
  downloadPromise = page.waitForEvent('download', { timeout: 60000 }); await page.locator('#exportStartBtn').click(); download = await downloadPromise;
  await download.saveAs('tmp/latex-tests/project-export.pdf'); await page.locator('#exportDismissBtn').click();
  await page.locator('#compileLatex').click(); await page.getByText('PDF is up to date.', { exact: true }).waitFor({ timeout: 60000 });
  await page.screenshot({ path: 'tmp/latex-tests/project-editor.png' });
  console.log('Project files, assets, XeLaTeX, BibTeX, index, two-way SyncTeX, ZIP round-trip, restoration and project PDF export passed.');
  assert.deepEqual(errors, []);
  console.log('LaTeX preview, diagnostics, source preservation, restoration, import, save, PDF export and mixed batch export passed.');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }

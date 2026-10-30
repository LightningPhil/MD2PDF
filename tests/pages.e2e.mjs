import { build } from 'vite';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const remote = process.env.PAGES_TEST_URL;
let server;
if (!remote) {
  await build({ mode: 'pages', logLevel: 'error' });
  const directory = path.resolve('dist');
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/MD2PDF/')) { response.writeHead(404); response.end(); return; }
      const file = path.resolve(directory, decodeURIComponent(url.pathname.slice('/MD2PDF/'.length)) || 'index.html');
      if (!file.startsWith(directory + path.sep)) throw new Error('Invalid path');
      const data = await readFile(file); response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); response.end(data);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}
const base = remote || `http://127.0.0.1:${server.address().port}/MD2PDF/`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1450, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
const errors = []; const requests = []; const badResponses = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
await page.addInitScript(() => { window.print = () => { document.body.dataset.printRequested = 'true'; }; });
await mkdir('tmp/pages-tests', { recursive: true });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  const editor = page.locator('#markdownEditor');
  await editor.fill('# Portable equations\n\nA browser-only document with **bold text**.\n\n$$\n\\int_0^1 x^2\\,dx=\\frac{1}{3}\n$$\n\n| Result | Value |\n| --- | --- |\n| Integral | 1/3 |\n');
  await page.locator('#previewContainer .katex').first().waitFor();
  assert.equal(await page.locator('#newLatexDocument').count(), 0);
  await page.locator('#pageSizeSelect').selectOption('letter');
  await page.waitForFunction(() => document.getElementById('saveStatus').textContent === 'Saved locally');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  assert.match(await editor.inputValue(), /Portable equations/);
  await context.setOffline(true);
  await editor.press('End'); await editor.press('Enter'); await editor.pressSequentially('Works without a backend.');
  await page.locator('#exportPdfBtn').click();
  await page.getByText('No equation, image, reference, or layout problems found.').waitFor();
  await page.locator('#exportStartBtn').click();
  await page.waitForFunction(() => document.body.dataset.printRequested === 'true');
  assert.equal(await page.locator('#browserPrintOutput .page').count(), 1);
  assert.equal(await page.locator('#browserPrintOutput .katex').count() > 0, true);
  await page.pdf({ path: 'tmp/pages-tests/browser.pdf', preferCSSPageSize: true, printBackground: true });
  await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); delete document.body.dataset.printRequested; });
  const downloadPromise = page.waitForEvent('download'); await page.locator('#savePackage').click();
  const download = await downloadPromise; await download.saveAs('tmp/pages-tests/document.md2pdf.zip');
  await page.screenshot({ path: 'tmp/pages-tests/site.png' });
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  assert.ok(!requests.some(url => url.includes('/api/')));
  console.log(`Static site passed: ${base} — equations, autosave, offline editing, PDF output and package download; no backend requests.`);
} finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }

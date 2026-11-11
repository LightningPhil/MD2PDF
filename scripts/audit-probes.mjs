import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Run only during an authorized live test. These collect observations of the
// current checkout, not acceptance assertions. Historical baseline JSON in
// docs/audit is intentionally not overwritten. Uses an isolated browser profile.

const server = await createServer({ server: { host: '127.0.0.1', port: 4329, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
const results = {};
try {
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  const editor = page.locator('#markdownEditor');
  await editor.fill('`Example $x$ must remain literal`');
  results.codeMath = { renderedMathInCode: await page.locator('#previewContainer code .katex').count(), text: await page.locator('#previewContainer code').innerText() };
  await editor.fill('Prices are \\$5 and \\$10.');
  results.escapedDollars = { mathCount: await page.locator('#previewContainer .katex').count(), text: await page.locator('#previewContainer .page-content').innerText() };
  await editor.fill('`<img src="data:image/png;base64,broken" onerror="document.body.dataset.auditInjection=String(1)"> $x$`');
  await page.waitForTimeout(100);
  results.sanitization = { harmlessMarker: await page.getAttribute('body', 'data-audit-injection'), executableAttributes: await page.locator('#previewContainer [onerror]').count() };
  results.tableCaption = await page.evaluate(async () => { const { tableMarkdown } = await import('/src/media-tools.ts'); return tableMarkdown([['Reading'],['10']], ['left'], 'Measured reading', ''); });
  await editor.fill('# Original\n\nKeep this text.');
  await editor.press('End'); await editor.pressSequentially(' Edited');
  await page.locator('#newDocument').click();
  await page.locator('#documentList .document-item').first().click();
  const beforeUndo = await editor.inputValue(); await editor.press('Control+z');
  results.undoAcrossSwitch = { before: beforeUndo, after: await editor.inputValue() };
  await page.locator('#documentList .document-item-action-close').first().click();
  const closeDialog = page.getByRole('dialog', { name: 'Close document?', exact: true });
  results.closeWarning = await closeDialog.innerText();
  await closeDialog.getByRole('button', { name: 'Close document', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('saveStatus').textContent === 'Saved locally');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));
  results.closeRecovery = { documentsAfterReload: await page.locator('#documentList .document-item').count(), remainingText: await editor.inputValue() };
  results.mathModeControl = { obsoleteToggleCount: await page.locator('#mathToggle').count() };
  results.printStyles = await page.evaluate(async () => {
    const {prepareBrowserPrint} = await import('/src/browser-print.ts');
    const {DEFAULT_SETTINGS,encodeDocument} = await import('/src/document.ts');
    const content = '| A | B |\n|---|---|\n| 1 | 2 |';
    const cleanup = await prepareBrowserPrint([
      {filename:'technical.md',content:encodeDocument(content,{...DEFAULT_SETTINGS,preset:'technical'})},
      {filename:'notes.md',content:encodeDocument(content,{...DEFAULT_SETTINGS,preset:'notes'})}
    ]);
    const backgrounds = [...document.querySelectorAll('#browserPrintOutput section th:first-child')].map(el=>getComputedStyle(el).backgroundColor);
    const rootPreset = document.documentElement.dataset.documentPreset;
    cleanup(); return {backgrounds,rootPreset};
  });
  await page.locator('#documentLayout').click();
  const layout=page.getByRole('dialog',{name:'Document style & layout'});
  await layout.locator('[name=titlePage]').check();
  await layout.locator('[name=title]').fill('Cover only');
  await layout.getByRole('button',{name:'Apply to document'}).click();
  const activeCount = await page.locator('#previewContainer > .page').count();
  await page.locator('#uploadFile').setInputFiles({name:'other.md',mimeType:'text/markdown',buffer:Buffer.from('# Other')});
  results.coverOnlyCount = { activeCount, inactiveBadge: await page.locator('#documentList .document-item-pages').first().innerText() };
  results.editorKeyboard = await page.evaluate(()=>({label:document.getElementById('markdownEditor').getAttribute('aria-label'),labelledby:document.getElementById('markdownEditor').getAttribute('aria-labelledby'),associatedLabels:document.getElementById('markdownEditor').labels.length}));
  await editor.focus(); await editor.press('Tab');
  results.editorKeyboard.tabFocus = await page.evaluate(()=>document.activeElement.id);
  await editor.press('Shift+Tab');
  results.editorKeyboard.shiftTabFocus = await page.evaluate(()=>document.activeElement.id);
  await page.setViewportSize({width:650,height:900});
  results.narrowWorkspace = { sidebarVisible: await page.locator('#documentSidebar').isVisible(), openDocuments: await page.locator('#documentList .document-item').count(), visibleDocumentSelectors: await page.locator('#documentList .document-item:visible').count() };
  await mkdir('tmp/audit', {recursive:true});
  await writeFile('tmp/audit/probe-results.json',JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); await server.close(); }

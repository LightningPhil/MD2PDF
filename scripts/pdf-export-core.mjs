import { compileLatex } from './latex-compile.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PAGE_SIZES = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  tabloid: { widthMm: 279.4, heightMm: 431.8 },
  a3: { widthMm: 297, heightMm: 420 },
};

export function normalizePageSizeKey(value) {
  const key = String(value || 'a4').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PAGE_SIZES, key)) {
    throw new Error(`Unsupported page size '${key}'. Allowed: ${Object.keys(PAGE_SIZES).join(', ')}`);
  }
  return key;
}

export function resolveOutputPath(inputPath, outputPath) {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const inputAbsolute = path.resolve(inputPath);
  const inputDir = path.dirname(inputAbsolute);
  const inputName = path.basename(inputAbsolute, path.extname(inputAbsolute));
  return path.join(inputDir, `${inputName}.pdf`);
}

export async function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function closePreviewServer(previewServer) {
  return new Promise((resolve, reject) => {
    previewServer.httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function loadPlaywright() {
  try {
    const playwrightModule = await import('playwright');
    return playwrightModule.chromium;
  } catch (error) {
    console.error('Playwright is required for PDF export. Run npm install and then npx playwright install chromium.');
    throw error;
  }
}

async function loadVite() {
  try {
    const viteModule = await import('vite');
    return {
      buildFn: viteModule.build,
      previewFn: viteModule.preview,
    };
  } catch (error) {
    console.error('Vite is required for PDF export. Run npm install and retry.');
    throw error;
  }
}

export async function createPdfExportSession(options = {}) {
  const {
    build = true,
    host = '127.0.0.1',
    port = 4173,
    appUrl = null,
  } = options;

  let previewServer = null;
  let resolvedPreviewUrl = appUrl;

  if (!resolvedPreviewUrl) {
    const { buildFn, previewFn } = await loadVite();

    if (build) {
      console.log('Building app for export...');
      await buildFn({ logLevel: 'error' });
    }

    console.log('Starting preview server...');
    previewServer = await previewFn({
      logLevel: 'error',
      preview: {
        host,
        port,
        strictPort: false,
      },
    });

    resolvedPreviewUrl = previewServer.resolvedUrls?.local?.[0] ?? `http://${host}:${port}/`;
  }

  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  await page.goto(resolvedPreviewUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#markdownEditor');
  await page.waitForFunction(() => !document.body.classList.contains('restoring-workspace'));

  async function exportMarkdownToPdf({
    markdownText,
    sourceFilename,
    latexProject,
    outputPath,
    pageSizeKey = 'a4',
    fontSizePx,
    marginMm,
    mathMode = 'html',
  }) {
    if (/\.tex$/i.test(sourceFilename || '')) {
      const result = await compileLatex(markdownText, latexProject);
      if (!result.success) throw new Error(result.diagnostics.map(d => d.message).join('\n') || result.log);
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      if (outputPath) { await ensureDirForFile(outputPath); await fs.writeFile(outputPath, pdfBuffer); }
      return { outputPath: outputPath || null, pageSizeKey, pageSize: PAGE_SIZES[pageSizeKey], pdfBuffer };
    }
    let documentSettings = {};
    const metadata = /^<!-- md2pdf:([^\n]+) -->/.exec(markdownText);
    if (metadata) {
      try {
        const parsed = JSON.parse(metadata[1]);
        if (parsed && typeof parsed === 'object') documentSettings = parsed;
      } catch { /* Ordinary Markdown remains exportable. */ }
    }
    const normalizedPageSizeKey = normalizePageSizeKey(Object.prototype.hasOwnProperty.call(PAGE_SIZES, documentSettings.pageSize) ? documentSettings.pageSize : pageSizeKey);
    const pageSize = PAGE_SIZES[normalizedPageSizeKey];
    const resolvedOutputPath = outputPath ? path.resolve(outputPath) : null;

    const normalizedFontSize = Number.isFinite(Number(documentSettings.fontSize ?? fontSizePx)) ? Math.min(20, Math.max(10, Number(documentSettings.fontSize ?? fontSizePx))) : null;
    const normalizedMarginMm = Number.isFinite(Number(documentSettings.margin ?? marginMm)) ? Math.min(30, Math.max(15, Number(documentSettings.margin ?? marginMm))) : null;
    const normalizedMathMode = String(mathMode || 'html').toLowerCase() === 'svg' ? 'svg' : 'html';

    await page.evaluate(({
      markdown,
      selectedPageSize,
      widthMm,
      heightMm,
      fontSize,
      margin,
      selectedMathMode,
    }) => {
      const textarea = document.getElementById('markdownEditor');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = markdown;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const pageSizeSelect = document.getElementById('pageSizeSelect');
      if (pageSizeSelect instanceof HTMLSelectElement) {
        pageSizeSelect.value = selectedPageSize;
        pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const fontSizeSelect = document.getElementById('fontSizeSelect');
      if (fontSizeSelect instanceof HTMLSelectElement && fontSize !== null) {
        const value = String(fontSize);
        let optionExists = false;
        Array.from(fontSizeSelect.options).forEach((option) => {
          if (option.value === value) {
            optionExists = true;
          }
        });

        if (!optionExists) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = `${value}px`;
          fontSizeSelect.appendChild(option);
        }

        fontSizeSelect.value = value;
        fontSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const marginSelect = document.getElementById('marginSelect');
      if (marginSelect instanceof HTMLSelectElement && margin !== null) {
        const value = String(margin);
        let optionExists = false;
        Array.from(marginSelect.options).forEach((option) => {
          if (option.value === value) {
            optionExists = true;
          }
        });

        if (!optionExists) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = `${value}mm`;
          marginSelect.appendChild(option);
        }

        marginSelect.value = value;
        marginSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const mathToggle = document.getElementById('mathToggle');
      if (mathToggle instanceof HTMLButtonElement) {
        const buttonText = mathToggle.textContent || '';
        const currentlySvg = buttonText.includes('SVG');
        const shouldUseSvg = selectedMathMode === 'svg';
        if (currentlySvg !== shouldUseSvg) {
          mathToggle.click();
        }
      }

      document.documentElement.dataset.exportMode = 'pdf';

      let exportStyle = document.getElementById('exportPageStyle');
      if (!(exportStyle instanceof HTMLStyleElement)) {
        exportStyle = document.createElement('style');
        exportStyle.id = 'exportPageStyle';
        document.head.appendChild(exportStyle);
      }

      exportStyle.textContent = `
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 0;
        }
        @media print {
          html[data-export-mode='pdf'] body {
            margin: 0 !important;
          }
        }
      `;
    }, {
      markdown: markdownText,
      selectedPageSize: normalizedPageSizeKey,
      widthMm: pageSize.widthMm,
      heightMm: pageSize.heightMm,
      fontSize: normalizedFontSize,
      margin: normalizedMarginMm,
      selectedMathMode: normalizedMathMode,
    });

    await page.waitForFunction(() => document.querySelectorAll('#previewContainer .page').length > 0);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll('#previewContainer img')).map(image => image.decode().catch(() => {})));
      const textarea = document.getElementById('markdownEditor');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      document.title = document.querySelector('.document-title-page h1, .page-content h1')?.textContent || 'Document';
    });
    await page.waitForTimeout(150);
    await page.emulateMedia({ media: 'print' });

    if (resolvedOutputPath) {
      await ensureDirForFile(resolvedOutputPath);
    }

    const pdfBuffer = await page.pdf({
      path: resolvedOutputPath || undefined,
      width: `${pageSize.widthMm}mm`,
      height: `${pageSize.heightMm}mm`,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      printBackground: true,
      outline: true,
      tagged: true,
      preferCSSPageSize: true,
    });

    return {
      outputPath: resolvedOutputPath,
      pageSizeKey: normalizedPageSizeKey,
      pageSize,
      pdfBuffer,
    };
  }

  async function close() {
    try {
      await browser.close();
    } finally {
      if (previewServer) {
        await closePreviewServer(previewServer);
      }
    }
  }

  return {
    exportMarkdownToPdf,
    close,
  };
}

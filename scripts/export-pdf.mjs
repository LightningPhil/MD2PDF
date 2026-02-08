#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PAGE_SIZES = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  tabloid: { widthMm: 279.4, heightMm: 431.8 },
  a3: { widthMm: 297, heightMm: 420 },
};

function printUsage() {
  console.log(`
Usage:
  node scripts/export-pdf.mjs --input <markdown-file> [--output <pdf-file>] [--page-size <size>]
  node scripts/export-pdf.mjs <markdown-file> [<pdf-file>] [<size>]

Options:
  --input      Path to source markdown (required)
  --output     Output PDF path (default: <input-dir>/<input-name>.pdf)
  --page-size  a4 | letter | legal | tabloid | a3 (default: a4)

Examples:
  node scripts/export-pdf.mjs --input samples/sample.md
  node scripts/export-pdf.mjs --input samples/sample.md --output dist/exports/sample.pdf --page-size letter
  npm run export:pdf -- samples/sample.md dist/exports/sample.pdf a4
`);
}

function parseArgs(argv) {
  const parsed = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }

    if (token === '-h' || token === '--help') {
      parsed.help = 'true';
      continue;
    }

    if (!token.startsWith('--')) {
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > -1) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      parsed[key] = value;
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[i + 1];
    const value = nextToken && !nextToken.startsWith('-') ? nextToken : 'true';
    parsed[key] = value;

    if (value !== 'true') {
      i += 1;
    }
  }

  return { parsed, positionals };
}

async function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function resolveOutputPath(inputPath, outputPath) {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const inputAbsolute = path.resolve(inputPath);
  const inputDir = path.dirname(inputAbsolute);
  const inputName = path.basename(inputAbsolute, path.extname(inputAbsolute));
  return path.join(inputDir, `${inputName}.pdf`);
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

async function main() {
  const { parsed, positionals } = parseArgs(process.argv.slice(2));

  const args = { ...parsed };
  if (!args.input && positionals[0]) {
    args.input = positionals[0];
  }
  if (!args.output && positionals[1]) {
    args.output = positionals[1];
  }
  if (!args['page-size'] && positionals[2]) {
    args['page-size'] = positionals[2];
  }

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  if (!args.input) {
    printUsage();
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  const outputPath = resolveOutputPath(inputPath, args.output);
  const pageSizeKey = String(args['page-size'] || 'a4').toLowerCase();
  const pageSize = PAGE_SIZES[pageSizeKey];

  if (!pageSize) {
    console.error(`Unsupported page size '${pageSizeKey}'. Allowed: ${Object.keys(PAGE_SIZES).join(', ')}`);
    process.exit(1);
  }

  const markdown = await fs.readFile(inputPath, 'utf8');

  let buildFn;
  let previewFn;
  let chromium;

  try {
    const viteModule = await import('vite');
    buildFn = viteModule.build;
    previewFn = viteModule.preview;
  } catch (error) {
    console.error('Vite is required for PDF export. Run npm install and retry.');
    throw error;
  }

  try {
    const playwrightModule = await import('playwright');
    chromium = playwrightModule.chromium;
  } catch (error) {
    console.error('Playwright is required for PDF export. Run npm install and then npx playwright install chromium.');
    throw error;
  }

  console.log('Building app for export...');
  await buildFn({ logLevel: 'error' });

  console.log('Starting preview server...');
  const previewServer = await previewFn({
    logLevel: 'error',
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false,
    },
  });

  const previewUrl = previewServer.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:4173/';

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1200 },
    });

    await page.goto(previewUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('#markdownEditor');

    await page.evaluate(({ markdownText, selectedPageSize }) => {
      const textarea = document.getElementById('markdownEditor');
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = markdownText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const pageSizeSelect = document.getElementById('pageSizeSelect');
      if (pageSizeSelect instanceof HTMLSelectElement) {
        pageSizeSelect.value = selectedPageSize;
        pageSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const mathToggle = document.getElementById('mathToggle');
      if (mathToggle instanceof HTMLButtonElement && mathToggle.textContent?.includes('SVG')) {
        mathToggle.click();
      }

      document.documentElement.dataset.exportMode = 'pdf';
    }, {
      markdownText: markdown,
      selectedPageSize: pageSizeKey,
    });

    // Wait for rendering and pagination to settle.
    await page.waitForTimeout(350);
    await page.emulateMedia({ media: 'print' });

    await page.addStyleTag({
      content: `
        @page {
          size: ${pageSize.widthMm}mm ${pageSize.heightMm}mm;
          margin: 0;
        }
      `,
    });

    await ensureDirForFile(outputPath);

    await page.pdf({
      path: outputPath,
      width: `${pageSize.widthMm}mm`,
      height: `${pageSize.heightMm}mm`,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      printBackground: true,
      preferCSSPageSize: true,
    });

    console.log(`PDF exported: ${outputPath}`);
    console.log(`Page size: ${pageSizeKey.toUpperCase()} (${pageSize.widthMm}mm x ${pageSize.heightMm}mm)`);
    console.log('Math mode forced to KaTeX HTML for export.');
  } finally {
    if (browser) {
      await browser.close();
    }
    await closePreviewServer(previewServer);
  }
}

main().catch((error) => {
  console.error('PDF export failed:', error);
  process.exit(1);
});

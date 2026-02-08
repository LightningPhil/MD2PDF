#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';
import {
  createPdfExportSession,
  normalizePageSizeKey,
  resolveOutputPath,
} from './pdf-export-core.mjs';

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

  const inputPath = args.input;
  const outputPath = resolveOutputPath(inputPath, args.output);
  const pageSizeKey = normalizePageSizeKey(args['page-size'] || 'a4');

  const markdown = await fs.readFile(inputPath, 'utf8');

  const session = await createPdfExportSession({ build: true });

  try {
    const exportResult = await session.exportMarkdownToPdf({
      markdownText: markdown,
      outputPath,
      pageSizeKey,
    });

    console.log(`PDF exported: ${exportResult.outputPath}`);
    console.log(`Page size: ${pageSizeKey.toUpperCase()} (${exportResult.pageSize.widthMm}mm x ${exportResult.pageSize.heightMm}mm)`);
    console.log('Math mode forced to KaTeX HTML for export.');
  } finally {
    await session.close();
  }
}

main().catch((error) => {
  console.error('PDF export failed:', error);
  process.exit(1);
});

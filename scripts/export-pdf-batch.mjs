#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createPdfExportSession, normalizePageSizeKey } from './pdf-export-core.mjs';

function printUsage() {
  console.log(`
Usage:
  node scripts/export-pdf-batch.mjs --input-dir <dir> [--recursive] [--out-dir <dir>] [--page-size <size>] [--zip [<zip-file>]]
  node scripts/export-pdf-batch.mjs <file1.md> <file2.md> ... [--out-dir <dir>] [--page-size <size>] [--zip [<zip-file>]]

Options:
  --input-dir  Directory to scan for markdown files
  --recursive  Scan input directory recursively
  --inputs     Comma-separated list of markdown files
  --out-dir    Output directory (default: dist/exports/batch-<timestamp>)
  --page-size  a4 | letter | legal | tabloid | a3 (default: a4)
  --zip        Create ZIP from exported PDFs; optional custom output path
  --clean      Remove out-dir before export if it already exists

Examples:
  node scripts/export-pdf-batch.mjs --input-dir samples --recursive --zip
  node scripts/export-pdf-batch.mjs samples/sample.md docs/chapter1.md --out-dir dist/exports/run1 --zip dist/exports/run1.zip
  npm run export:pdf:batch -- samples/sample.md todo.md dist/exports/run1 dist/exports/run1.zip a4
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

function makeTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

async function collectMarkdownFiles(inputDir, recursive) {
  const collected = [];
  const stack = [path.resolve(inputDir)];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          stack.push(fullPath);
        }
        continue;
      }

      if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        collected.push(fullPath);
      }
    }
  }

  collected.sort((a, b) => a.localeCompare(b));
  return collected;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function dedupePaths(paths) {
  const seen = new Set();
  const result = [];

  for (const value of paths) {
    const normalized = path.resolve(value);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function isChildPath(filePath, parentDir) {
  const rel = path.relative(parentDir, filePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function findCommonBaseDir(filePaths) {
  if (filePaths.length === 0) {
    return process.cwd();
  }

  let commonDir = path.dirname(filePaths[0]);
  for (const filePath of filePaths.slice(1)) {
    while (!isChildPath(filePath, commonDir)) {
      const parent = path.dirname(commonDir);
      if (parent === commonDir) {
        return parent;
      }
      commonDir = parent;
    }
  }

  return commonDir;
}

function stripExtension(filePath) {
  return filePath.slice(0, filePath.length - path.extname(filePath).length);
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr.trim()}`));
    });
  });
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function createZipFromDir(sourceDir, zipPath) {
  const resolvedSourceDir = path.resolve(sourceDir);
  const resolvedZipPath = path.resolve(zipPath);

  await ensureParentDir(resolvedZipPath);
  await fs.rm(resolvedZipPath, { force: true });

  if (process.platform === 'win32') {
    const sourceGlob = path.join(resolvedSourceDir, '*');
    const script = `$ErrorActionPreference='Stop'; Compress-Archive -Path ${quotePowerShell(sourceGlob)} -DestinationPath ${quotePowerShell(resolvedZipPath)} -Force`;
    await runCommand('powershell.exe', ['-NoProfile', '-Command', script]);
    return;
  }

  await runCommand('zip', ['-r', '-q', resolvedZipPath, '.'], { cwd: resolvedSourceDir });
}

function resolveZipPath(zipArg, outDir) {
  if (zipArg && zipArg !== 'true') {
    return path.resolve(zipArg);
  }

  return path.resolve(path.join(path.dirname(outDir), `${path.basename(outDir)}.zip`));
}

async function resolveInputFiles(args, positionals) {
  const candidates = [];

  if (args.input) {
    candidates.push(args.input);
  }

  if (args.inputs) {
    args.inputs
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => candidates.push(value));
  }

  positionals.forEach((value) => candidates.push(value));

  if (args['input-dir']) {
    const recursive = args.recursive === 'true';
    const filesFromDir = await collectMarkdownFiles(args['input-dir'], recursive);
    filesFromDir.forEach((filePath) => candidates.push(filePath));
  }

  const unique = dedupePaths(candidates);
  const existing = [];

  for (const filePath of unique) {
    if (await fileExists(filePath)) {
      existing.push(filePath);
      continue;
    }
    console.warn(`Skipping missing file: ${filePath}`);
  }

  return existing;
}

async function inferOptionsFromPositionals(args, positionals) {
  const remaining = [...positionals];

  if (!args['page-size'] && remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    try {
      args['page-size'] = normalizePageSizeKey(last);
      remaining.pop();
    } catch {
      // Not a valid page-size token; keep as positional.
    }
  }

  if (!args.zip && remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    if (/\.zip$/i.test(last)) {
      args.zip = last;
      remaining.pop();
    }
  }

  if (!args['out-dir'] && remaining.length > 0) {
    const last = remaining[remaining.length - 1];
    const looksLikeMarkdown = /\.(md|markdown)$/i.test(last);
    const exists = await fileExists(last);

    if (!looksLikeMarkdown && !exists) {
      args['out-dir'] = last;
      remaining.pop();
    }
  }

  return remaining;
}

async function main() {
  const { parsed, positionals } = parseArgs(process.argv.slice(2));
  const args = { ...parsed };

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const inferredPositionals = await inferOptionsFromPositionals(args, positionals);
  const inputs = await resolveInputFiles(args, inferredPositionals);
  if (inputs.length === 0) {
    console.error('No input markdown files found.');
    printUsage();
    process.exit(1);
  }

  const pageSizeKey = normalizePageSizeKey(args['page-size'] || 'a4');
  const outDir = path.resolve(args['out-dir'] || path.join('dist', 'exports', `batch-${makeTimestamp()}`));
  const cleanOutDir = args.clean === 'true';

  if (cleanOutDir) {
    await fs.rm(outDir, { recursive: true, force: true });
  }
  await fs.mkdir(outDir, { recursive: true });

  const baseDir = args['input-dir'] ? path.resolve(args['input-dir']) : findCommonBaseDir(inputs);

  console.log(`Inputs: ${inputs.length}`);
  console.log(`Output directory: ${outDir}`);
  console.log(`Page size: ${pageSizeKey.toUpperCase()}`);

  const session = await createPdfExportSession({ build: true });
  const exported = [];

  try {
    for (let index = 0; index < inputs.length; index += 1) {
      const inputPath = inputs[index];
      const markdownText = await fs.readFile(inputPath, 'utf8');

      const relative = path.relative(baseDir, inputPath);
      const safeRelative = relative && !relative.startsWith('..') && !path.isAbsolute(relative)
        ? relative
        : path.basename(inputPath);
      const outputRelative = `${stripExtension(safeRelative)}.pdf`;
      const outputPath = path.join(outDir, outputRelative);

      const result = await session.exportMarkdownToPdf({
        markdownText,
        outputPath,
        pageSizeKey,
      });

      exported.push(result.outputPath);
      console.log(`[${index + 1}/${inputs.length}] Exported ${result.outputPath}`);
    }
  } finally {
    await session.close();
  }

  if (args.zip) {
    const zipPath = resolveZipPath(args.zip, outDir);
    await createZipFromDir(outDir, zipPath);
    console.log(`ZIP created: ${zipPath}`);
  }

  console.log(`Batch export complete. PDFs generated: ${exported.length}`);
}

main().catch((error) => {
  console.error('Batch PDF export failed:', error);
  process.exit(1);
});

import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface ExportDocInput {
  filename: string;
  content: string;
}

interface ExportPayload {
  pageSize: string;
  fontSizePx: number | null;
  marginMm: number | null;
  mathMode: 'html' | 'svg';
}

interface ExportCoreResult {
  outputPath: string | null;
  pageSizeKey: string;
  pageSize: {
    widthMm: number;
    heightMm: number;
  };
  pdfBuffer: Buffer;
}

interface ExportSession {
  exportMarkdownToPdf(args: {
    markdownText: string;
    outputPath?: string;
    pageSizeKey?: string;
    fontSizePx?: number | null;
    marginMm?: number | null;
    mathMode?: 'html' | 'svg';
  }): Promise<ExportCoreResult>;
  close(): Promise<void>;
}

interface ExportCoreModule {
  createPdfExportSession(options: {
    build?: boolean;
    host?: string;
    port?: number;
    appUrl?: string | null;
  }): Promise<ExportSession>;
  normalizePageSizeKey(value: string): string;
}

type NextFunction = (error?: unknown) => void;

let coreModulePromise: Promise<ExportCoreModule> | null = null;

function loadCoreModule(): Promise<ExportCoreModule> {
  if (!coreModulePromise) {
    coreModulePromise = import('./scripts/pdf-export-core.mjs') as Promise<ExportCoreModule>;
  }
  return coreModulePromise;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMathMode(value: unknown): 'html' | 'svg' {
  return String(value || 'html').toLowerCase() === 'svg' ? 'svg' : 'html';
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function sendJsonError(response: ServerResponse, statusCode: number, message: string): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: message }));
}

function sanitizeFileStem(value: string): string {
  const trimmed = value.trim();
  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1f]/gi, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || 'document';
}

function ensurePdfFilename(value: string): string {
  const baseName = path.basename(value || 'document', path.extname(value || 'document'));
  return `${sanitizeFileStem(baseName)}.pdf`;
}

function ensureZipFilename(value: string): string {
  const baseName = path.basename(value || 'md2pdf-export', path.extname(value || 'md2pdf-export'));
  return `${sanitizeFileStem(baseName)}.zip`;
}

function makeUniqueFilename(filename: string, used: Set<string>): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);

  let counter = 1;
  let candidate = filename;

  while (true) {
    const key = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
    if (!used.has(key)) {
      used.add(key);
      return candidate;
    }
    counter += 1;
    candidate = `${stem} (${counter})${ext}`;
  }
}

function parseExportPayload(raw: Record<string, unknown>): ExportPayload {
  const pageSize = String(raw.pageSize || 'a4');

  return {
    pageSize,
    fontSizePx: toNumberOrNull(raw.fontSizePx),
    marginMm: toNumberOrNull(raw.marginMm),
    mathMode: normalizeMathMode(raw.mathMode),
  };
}

function parseSingleRequest(body: unknown): { document: ExportDocInput; settings: ExportPayload } {
  const raw = asRecord(body);
  if (!raw) {
    throw new Error('Request body must be a JSON object.');
  }

  const filename = String(raw.filename || 'document.md');
  const content = String(raw.content ?? raw.markdown ?? '');

  return {
    document: {
      filename,
      content,
    },
    settings: parseExportPayload(raw),
  };
}

function parseAllRequest(body: unknown): { documents: ExportDocInput[]; settings: ExportPayload; zipFilename: string } {
  const raw = asRecord(body);
  if (!raw) {
    throw new Error('Request body must be a JSON object.');
  }

  const documentsRaw = Array.isArray(raw.documents) ? raw.documents : [];
  const documents = documentsRaw
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      return {
        filename: String(record.filename || 'document.md'),
        content: String(record.content ?? record.markdown ?? ''),
      };
    })
    .filter((item): item is ExportDocInput => item !== null);

  if (documents.length === 0) {
    throw new Error('No documents were provided for export.');
  }

  const zipFilename = ensureZipFilename(String(raw.zipFilename || 'md2pdf-export.zip'));

  return {
    documents,
    settings: parseExportPayload(raw),
    zipFilename,
  };
}

function runCommand(command: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function createZipFromDir(sourceDir: string, zipPath: string): Promise<void> {
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.rm(zipPath, { force: true });

  if (process.platform === 'win32') {
    const sourceGlob = path.join(sourceDir, '*');
    const script = `$ErrorActionPreference='Stop'; Compress-Archive -Path ${quotePowerShell(sourceGlob)} -DestinationPath ${quotePowerShell(zipPath)} -Force`;
    await runCommand('powershell.exe', ['-NoProfile', '-Command', script]);
    return;
  }

  await runCommand('zip', ['-r', '-q', zipPath, '.'], sourceDir);
}

function normalizeBasePath(basePath: string): string {
  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function buildAppUrl(request: IncomingMessage, basePath: string): string {
  const host = request.headers.host || '127.0.0.1:3000';
  return `http://${host}${normalizeBasePath(basePath)}`;
}

async function handleSingleExport(request: IncomingMessage, response: ServerResponse, basePath: string): Promise<void> {
  const { document, settings } = parseSingleRequest(await readJsonBody(request));
  const core = await loadCoreModule();
  const pageSizeKey = core.normalizePageSizeKey(settings.pageSize);
  const appUrl = buildAppUrl(request, basePath);

  const session = await core.createPdfExportSession({ build: false, appUrl });

  try {
    const result = await session.exportMarkdownToPdf({
      markdownText: document.content,
      pageSizeKey,
      fontSizePx: settings.fontSizePx,
      marginMm: settings.marginMm,
      mathMode: settings.mathMode,
    });

    const outputName = ensurePdfFilename(document.filename);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    response.end(result.pdfBuffer);
  } finally {
    await session.close();
  }
}

async function handleAllExport(request: IncomingMessage, response: ServerResponse, basePath: string): Promise<void> {
  const { documents, settings, zipFilename } = parseAllRequest(await readJsonBody(request));
  const core = await loadCoreModule();
  const pageSizeKey = core.normalizePageSizeKey(settings.pageSize);
  const appUrl = buildAppUrl(request, basePath);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'md2pdf-export-'));
  const exportDir = path.join(tempRoot, 'pdfs');
  await fs.mkdir(exportDir, { recursive: true });

  const session = await core.createPdfExportSession({ build: false, appUrl });

  try {
    const usedNames = new Set<string>();

    for (const document of documents) {
      const pdfName = makeUniqueFilename(ensurePdfFilename(document.filename), usedNames);
      const result = await session.exportMarkdownToPdf({
        markdownText: document.content,
        pageSizeKey,
        fontSizePx: settings.fontSizePx,
        marginMm: settings.marginMm,
        mathMode: settings.mathMode,
      });

      const pdfPath = path.join(exportDir, pdfName);
      await fs.writeFile(pdfPath, result.pdfBuffer);
    }

    const zipPath = path.join(tempRoot, zipFilename);
    await createZipFromDir(exportDir, zipPath);

    const zipData = await fs.readFile(zipPath);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    response.end(zipData);
  } finally {
    await session.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function createExportApiPlugin(): Plugin {
  return {
    name: 'md2pdf-export-api',
    configureServer(server) {
      const basePath = server.config.base || '/';

      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
        void (async () => {
          const pathname = (request.url || '').split('?')[0];
          if (request.method !== 'POST' || (pathname !== '/api/export/pdf-single' && pathname !== '/api/export/pdf-all')) {
            next();
            return;
          }

          try {
            if (pathname === '/api/export/pdf-single') {
              await handleSingleExport(request, response, basePath);
              return;
            }

            await handleAllExport(request, response, basePath);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'PDF export failed.';
            sendJsonError(response, 500, message);
          }
        })();
      });
    },
    configurePreviewServer(server) {
      const basePath = server.config.base || '/';

      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
        void (async () => {
          const pathname = (request.url || '').split('?')[0];
          if (request.method !== 'POST' || (pathname !== '/api/export/pdf-single' && pathname !== '/api/export/pdf-all')) {
            next();
            return;
          }

          try {
            if (pathname === '/api/export/pdf-single') {
              await handleSingleExport(request, response, basePath);
              return;
            }

            await handleAllExport(request, response, basePath);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'PDF export failed.';
            sendJsonError(response, 500, message);
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [createExportApiPlugin()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});

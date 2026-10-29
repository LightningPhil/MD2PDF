import { compileLatex, syncLatex } from './scripts/latex-compile.mjs';
import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

interface ExportDocInput {
  latexProject?: unknown;
  filename: string;
  content: string;
}

interface ExportPayload {
  pageSize: string;
  fontSizePx: number | null;
  marginMm: number | null;
  mathMode: 'html' | 'svg';
}

type ExportJobScope = 'current' | 'all';
type ExportJobState = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

interface ExportJobRequest {
  mode: ExportJobScope;
  settings: ExportPayload;
  document?: ExportDocInput;
  documents?: ExportDocInput[];
  zipFilename?: string;
}

interface ExportJob {
  id: string;
  state: ExportJobState;
  mode: ExportJobScope;
  total: number;
  processed: number;
  message: string;
  log: string[];
  nextCursor: number;
  artifactName: string | null;
  artifactBuffer: Buffer | null;
  error: string | null;
  cancelRequested: boolean;
  startedAt: number;
  currentFileStartedAt: number | null;
  createdAt: number;
  updatedAt: number;
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
    sourceFilename?: string;
    latexProject?: unknown;
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
const exportJobs = new Map<string, ExportJob>();
const MAX_JOB_AGE_MS = 15 * 60 * 1000;
const MAX_JOB_COUNT = 60;

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
  let bodySize = 0;

  for await (const chunk of request) {
    bodySize += Buffer.byteLength(chunk);
    if (bodySize > 128 * 1024 * 1024) throw new Error('Request exceeds 128 MB.');
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
      latexProject: raw.latexProject,
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
    .map((item): ExportDocInput | null => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      return {
        filename: String(record.filename || 'document.md'),
        content: String(record.content ?? record.markdown ?? ''),
    latexProject: record.latexProject,
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

function parseDocumentInput(value: unknown): ExportDocInput | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return {
    filename: String(record.filename || 'document.md'),
    content: String(record.content ?? record.markdown ?? ''),
    latexProject: record.latexProject,
  };
}

function parseJobStartRequest(body: unknown): ExportJobRequest {
  const raw = asRecord(body);
  if (!raw) {
    throw new Error('Request body must be a JSON object.');
  }

  const mode = String(raw.mode || 'current').toLowerCase();
  if (mode !== 'current' && mode !== 'all') {
    throw new Error(`Unsupported export mode '${mode}'.`);
  }

  const settings = parseExportPayload(raw);

  if (mode === 'current') {
    const parsedDocument = parseDocumentInput(raw.document);
    const fallbackDocument: ExportDocInput = {
      filename: String(raw.filename || 'document.md'),
      content: String(raw.content ?? raw.markdown ?? ''),
    };

    return {
      mode: 'current',
      settings,
      document: parsedDocument ?? fallbackDocument,
    };
  }

  const documents = Array.isArray(raw.documents)
    ? raw.documents
      .map((item) => parseDocumentInput(item))
      .filter((item): item is ExportDocInput => item !== null)
    : [];

  if (documents.length === 0) {
    throw new Error('No documents were provided for export.');
  }

  return {
    mode: 'all',
    settings,
    documents,
    zipFilename: ensureZipFilename(String(raw.zipFilename || 'md2pdf-export.zip')),
  };
}

function parseUrl(request: IncomingMessage): URL {
  return new URL(request.url || '/', 'http://127.0.0.1');
}

function parseCursor(raw: string | null): number {
  if (!raw) {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
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

function cleanupOldJobs(): void {
  const now = Date.now();

  for (const [jobId, job] of exportJobs.entries()) {
    if (now - job.updatedAt > MAX_JOB_AGE_MS) {
      exportJobs.delete(jobId);
    }
  }

  if (exportJobs.size <= MAX_JOB_COUNT) {
    return;
  }

  const sortedByAge = Array.from(exportJobs.values())
    .sort((a, b) => a.updatedAt - b.updatedAt);

  const overflow = exportJobs.size - MAX_JOB_COUNT;
  for (let index = 0; index < overflow; index += 1) {
    const candidate = sortedByAge[index];
    if (candidate) {
      exportJobs.delete(candidate.id);
    }
  }
}

function formatDuration(milliseconds: number): string {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = safeMs / 1000;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - (minutes * 60);
  return `${minutes}m ${seconds.toFixed(1)}s`;
}

function createExportJob(request: ExportJobRequest): ExportJob {
  const now = Date.now();
  const total = request.mode === 'all'
    ? Math.max(1, request.documents?.length || 0)
    : 1;

  return {
    id: randomUUID(),
    state: 'queued',
    mode: request.mode,
    total,
    processed: 0,
    message: 'Queued',
    log: [],
    nextCursor: 0,
    artifactName: null,
    artifactBuffer: null,
    error: null,
    cancelRequested: false,
    startedAt: now,
    currentFileStartedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function setJobMessage(job: ExportJob, message: string): void {
  job.message = message;
  job.updatedAt = Date.now();
}

function addJobLog(job: ExportJob, line: string): void {
  job.log.push(line);
  if (job.log.length > 800) {
    const trimCount = job.log.length - 800;
    job.log.splice(0, trimCount);
  }
  job.nextCursor = job.log.length;
  job.updatedAt = Date.now();
}

function markJobFailed(job: ExportJob, message: string): void {
  job.state = 'failed';
  job.error = message;
  job.currentFileStartedAt = null;
  const elapsedMs = Date.now() - job.startedAt;
  setJobMessage(job, `Failed after ${formatDuration(elapsedMs)}: ${message}`);
  addJobLog(job, `Failed after ${formatDuration(elapsedMs)}: ${message}`);
}

function markJobCanceled(job: ExportJob): void {
  job.state = 'canceled';
  job.currentFileStartedAt = null;
  const elapsedMs = Date.now() - job.startedAt;
  setJobMessage(job, `Canceled after ${formatDuration(elapsedMs)}`);
  addJobLog(job, `Canceled by user request after ${formatDuration(elapsedMs)}.`);
}

function markJobCompleted(job: ExportJob, artifactName: string, artifactBuffer: Buffer): void {
  job.state = 'completed';
  job.processed = job.total;
  job.currentFileStartedAt = null;
  job.artifactName = artifactName;
  job.artifactBuffer = artifactBuffer;
  const elapsedMs = Date.now() - job.startedAt;
  setJobMessage(job, `Completed in ${formatDuration(elapsedMs)}: ${artifactName}`);
  addJobLog(job, `Completed in ${formatDuration(elapsedMs)}: ${artifactName}`);
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
          sourceFilename: document.filename,
          latexProject: document.latexProject,
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
          sourceFilename: document.filename,
          latexProject: document.latexProject,
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

async function runExportJob(job: ExportJob, request: ExportJobRequest, incomingRequest: IncomingMessage, basePath: string): Promise<void> {
  job.state = 'running';
  setJobMessage(job, 'Starting export...');
  addJobLog(job, `Started export job (${job.mode}).`);

  let session: ExportSession | null = null;

  try {
    const core = await loadCoreModule();
    const pageSizeKey = core.normalizePageSizeKey(request.settings.pageSize);
    const appUrl = buildAppUrl(incomingRequest, basePath);
    session = await core.createPdfExportSession({ build: false, appUrl });

    if (request.mode === 'current') {
      const document = request.document;
      if (!document) {
        throw new Error('Missing current document payload.');
      }

      if (job.cancelRequested) {
        markJobCanceled(job);
        return;
      }

      addJobLog(job, `Rendering ${document.filename}...`);
      setJobMessage(job, 'Rendering file 1 of 1...');
      job.currentFileStartedAt = Date.now();

      const result = await session.exportMarkdownToPdf({
        markdownText: document.content,
          sourceFilename: document.filename,
          latexProject: document.latexProject,
        pageSizeKey,
        fontSizePx: request.settings.fontSizePx,
        marginMm: request.settings.marginMm,
        mathMode: request.settings.mathMode,
      });

      if (job.cancelRequested) {
        markJobCanceled(job);
        return;
      }

      job.processed = 1;
      const fileElapsedMs = job.currentFileStartedAt ? Date.now() - job.currentFileStartedAt : 0;
      const totalElapsedMs = Date.now() - job.startedAt;
      job.currentFileStartedAt = null;
      addJobLog(
        job,
        `Rendered ${document.filename} in ${formatDuration(fileElapsedMs)} (total ${formatDuration(totalElapsedMs)}).`,
      );
      markJobCompleted(job, ensurePdfFilename(document.filename), result.pdfBuffer);
      return;
    }

    const documents = request.documents || [];
    if (documents.length === 0) {
      throw new Error('No documents available for all-file export.');
    }

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'md2pdf-export-job-'));
    const exportDir = path.join(tempRoot, 'pdfs');
    await fs.mkdir(exportDir, { recursive: true });

    try {
      const usedNames = new Set<string>();

      for (let index = 0; index < documents.length; index += 1) {
        if (job.cancelRequested) {
          markJobCanceled(job);
          return;
        }

        const document = documents[index];
        const pdfName = makeUniqueFilename(ensurePdfFilename(document.filename), usedNames);

        setJobMessage(job, `Rendering file ${index + 1} of ${documents.length}...`);
        addJobLog(job, `[${index + 1}/${documents.length}] Rendering ${document.filename}...`);
        job.currentFileStartedAt = Date.now();

        const result = await session.exportMarkdownToPdf({
          markdownText: document.content,
          sourceFilename: document.filename,
          latexProject: document.latexProject,
          pageSizeKey,
          fontSizePx: request.settings.fontSizePx,
          marginMm: request.settings.marginMm,
          mathMode: request.settings.mathMode,
        });

        const pdfPath = path.join(exportDir, pdfName);
        await fs.writeFile(pdfPath, result.pdfBuffer);

        job.processed = index + 1;
        const fileElapsedMs = job.currentFileStartedAt ? Date.now() - job.currentFileStartedAt : 0;
        const totalElapsedMs = Date.now() - job.startedAt;
        job.currentFileStartedAt = null;
        addJobLog(
          job,
          `[${index + 1}/${documents.length}] Rendered ${pdfName} in ${formatDuration(fileElapsedMs)} (total ${formatDuration(totalElapsedMs)}).`,
        );
      }

      if (job.cancelRequested) {
        markJobCanceled(job);
        return;
      }

      const zipFilename = ensureZipFilename(request.zipFilename || 'md2pdf-export.zip');
      const zipPath = path.join(tempRoot, zipFilename);
      setJobMessage(job, 'Creating ZIP archive...');
      addJobLog(job, `Creating ZIP archive after ${formatDuration(Date.now() - job.startedAt)}...`);

      await createZipFromDir(exportDir, zipPath);
      const zipBuffer = await fs.readFile(zipPath);

      if (job.cancelRequested) {
        markJobCanceled(job);
        return;
      }

      markJobCompleted(job, zipFilename, zipBuffer);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF export failed.';
    markJobFailed(job, message);
  } finally {
    if (session) {
      try {
        await session.close();
      } catch (closeError) {
        const message = closeError instanceof Error ? closeError.message : 'Failed to close export session.';
        addJobLog(job, message);
      }
    }
  }
}

async function handleStartJob(request: IncomingMessage, response: ServerResponse, basePath: string): Promise<void> {
  cleanupOldJobs();
  const payload = parseJobStartRequest(await readJsonBody(request));
  const job = createExportJob(payload);
  exportJobs.set(job.id, job);

  void runExportJob(job, payload, request, basePath);

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ jobId: job.id }));
}

function getJobOrFail(response: ServerResponse, jobId: string | null): ExportJob | null {
  if (!jobId) {
    sendJsonError(response, 400, 'Missing jobId.');
    return null;
  }

  const job = exportJobs.get(jobId);
  if (!job) {
    sendJsonError(response, 404, `Export job '${jobId}' not found.`);
    return null;
  }

  return job;
}

function handleJobStatus(request: IncomingMessage, response: ServerResponse): void {
  cleanupOldJobs();
  const requestUrl = parseUrl(request);
  const jobId = requestUrl.searchParams.get('jobId');
  const job = getJobOrFail(response, jobId);
  if (!job) {
    return;
  }

  const cursor = parseCursor(requestUrl.searchParams.get('cursor'));
  const start = Math.min(cursor, job.log.length);
  const now = Date.now();
  const elapsedMs = Math.max(0, now - job.startedAt);
  const currentFileElapsedMs = job.state === 'running' && job.currentFileStartedAt
    ? Math.max(0, now - job.currentFileStartedAt)
    : 0;

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({
    jobId: job.id,
    state: job.state,
    processed: job.processed,
    total: job.total,
    message: job.message,
    artifactName: job.artifactName,
    nextCursor: job.log.length,
    logEntries: job.log.slice(start),
    error: job.error,
    elapsedMs,
    currentFileElapsedMs,
  }));
}

async function handleJobCancel(request: IncomingMessage, response: ServerResponse): Promise<void> {
  cleanupOldJobs();
  const body = asRecord(await readJsonBody(request));
  const jobId = body ? String(body.jobId || '') : '';
  const job = getJobOrFail(response, jobId || null);
  if (!job) {
    return;
  }

  if (job.state === 'completed' || job.state === 'failed' || job.state === 'canceled') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: true, state: job.state }));
    return;
  }

  job.cancelRequested = true;
  addJobLog(job, 'Cancel requested by user.');
  if (job.state === 'queued') {
    markJobCanceled(job);
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ ok: true, state: job.state }));
}

function handleJobDownload(request: IncomingMessage, response: ServerResponse): void {
  cleanupOldJobs();
  const requestUrl = parseUrl(request);
  const jobId = requestUrl.searchParams.get('jobId');
  const job = getJobOrFail(response, jobId);
  if (!job) {
    return;
  }

  if (job.state !== 'completed' || !job.artifactBuffer || !job.artifactName) {
    sendJsonError(response, 409, 'Export is not ready for download yet.');
    return;
  }

  const isZip = /\.zip$/i.test(job.artifactName);
  response.statusCode = 200;
  response.setHeader('Content-Type', isZip ? 'application/zip' : 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${job.artifactName}"`);
  response.end(job.artifactBuffer);
}

async function routeExportApi(
  request: IncomingMessage,
  response: ServerResponse,
  next: NextFunction,
  basePath: string,
): Promise<void> {
  const requestUrl = parseUrl(request);
  const pathname = requestUrl.pathname;
  const method = request.method || 'GET';

  try {
    if (method === 'POST' && (pathname === '/api/latex/compile' || pathname === '/api/latex/sync')) {
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) { sendJsonError(response, 403, 'Use the local editor to compile.'); return; }
      const body = asRecord(await readJsonBody(request));
      const result = pathname.endsWith('/sync') ? await syncLatex(body) : await compileLatex(body?.source, body?.project, body?.keepBuild === true);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(result)); return;
    }
    if (method === 'POST' && pathname === '/api/export/pdf-single') {
      await handleSingleExport(request, response, basePath);
      return;
    }

    if (method === 'POST' && pathname === '/api/export/pdf-all') {
      await handleAllExport(request, response, basePath);
      return;
    }

    if (method === 'POST' && pathname === '/api/export/job/start') {
      await handleStartJob(request, response, basePath);
      return;
    }

    if (method === 'GET' && pathname === '/api/export/job/status') {
      handleJobStatus(request, response);
      return;
    }

    if (method === 'GET' && pathname === '/api/export/job/download') {
      handleJobDownload(request, response);
      return;
    }

    if (method === 'POST' && pathname === '/api/export/job/cancel') {
      await handleJobCancel(request, response);
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF export failed.';
    sendJsonError(response, 500, message);
    return;
  }

  next();
}

function createExportApiPlugin(): Plugin {
  return {
    name: 'md2pdf-export-api',
    configureServer(server) {
      const basePath = server.config.base || '/';

      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
        void routeExportApi(request, response, next, basePath);
      });
    },
    configurePreviewServer(server) {
      const basePath = server.config.base || '/';

      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
        void routeExportApi(request, response, next, basePath);
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

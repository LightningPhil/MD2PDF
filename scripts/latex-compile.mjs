import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const builds = new Map();
const buildRoot = path.join(os.tmpdir(), 'md2pdf-builds');
const engines = ['pdflatex', 'xelatex', 'lualatex'];
export function safeProjectPath(value) {
  if (typeof value !== 'string' || value.length > 200 || !value || value.includes('\\') || value.split('/').some(p => !p || p === '.' || p === '..' || /[<>:"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p)) || value.startsWith('/')) throw new Error('Use a relative project path without traversal or reserved names.');
  return value;
}
export function normalizeProject(source, project = {}) {
  if (typeof source !== 'string' || source.length > 2_000_000) throw new Error('LaTeX source must be smaller than 2 MB.');
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('Invalid project settings.');
  if (!Array.isArray(project.files || [])) throw new Error('Invalid project files.');
  const root = safeProjectPath(project.root || 'main.tex');
  if (!/\.tex$/i.test(root)) throw new Error('The primary source must be a .tex file.');
  const main = safeProjectPath(project.main || root);
  const engine = project.engine || 'pdflatex';
  if (!engines.includes(engine)) throw new Error('Unsupported LaTeX engine.');
  const files = [{ path: root, content: source, encoding: 'utf8' }, ...(project.files || [])];
  if (!Array.isArray(project.files || []) || files.length > 200) throw new Error('Projects support up to 200 files.');
  const names = new Set(); let total = 0;
  for (const file of files) {
    safeProjectPath(file.path);
    if (!/\.(tex|bib|bst|sty|cls|png|jpg|jpeg|pdf|eps|ttf|otf|ist|bbx|cbx|lbx|def|cfg|csv|txt|md|dat)$/i.test(file.path)) throw new Error(`Unsupported project file: ${file.path}`);
    if (/^md2pdf\.(pdf|aux|log|idx|ind|bbl|bcf)$/i.test(file.path)) throw new Error('The filename md2pdf is reserved for build output.');
    if (names.has(file.path.toLowerCase())) throw new Error(`Duplicate project path: ${file.path}`);
    names.add(file.path.toLowerCase());
    if (typeof file.content !== 'string' || !['utf8', 'base64'].includes(file.encoding)) throw new Error('Invalid project file encoding.');
    if (file.encoding === 'base64' && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new Error('Invalid base64 asset.');
    total += Buffer.byteLength(file.content, file.encoding);
    if (total > 50 * 1024 * 1024) throw new Error('Project exceeds 50 MB.');
  }
  if (!files.some(f => f.path === main && /\.tex$/i.test(main) && f.encoding === 'utf8')) throw new Error('Choose an existing .tex file as the main document.');
  const bibliography = project.bibliography || 'auto';
  if (!['auto', 'bibtex', 'biber', 'off'].includes(bibliography)) throw new Error('Unsupported bibliography processor.');
  return { root, main, engine, files, bibliography, index: project.index !== false };
}
async function run(command, args, directory) {
  const env = { ...process.env, openin_any: 'p', openout_any: 'p', SYNCTEX_EDITOR: '', SYNCTEX_VIEWER: '', MIKTEX_CORE_ALLOWUNSAFEINPUTFILES: 'false', MIKTEX_CORE_ALLOWUNSAFEOUTPUTFILES: 'false', MIKTEX_MPM_AUTOINSTALL: '0' };
  for (const app of ['PDFLATEX', 'XELATEX', 'LUALATEX', 'BIBTEX', 'MAKEINDEX']) {
    // Lua's font loader reads installed Unicode tables and system fonts via absolute paths.
    env[`MIKTEX_${app}_CORE_ALLOWUNSAFEINPUTFILES`] = app === 'LUALATEX' ? 'true' : 'false';
    env[`MIKTEX_${app}_CORE_ALLOWUNSAFEOUTPUTFILES`] = 'false';
    env[`MIKTEX_${app}_MPM_AUTOINSTALL`] = '0';
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: directory, windowsHide: true, env });
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90_000);
    child.stdout.on('data', d => { output = (output + d).slice(-200_000); });
    child.stderr.on('data', d => { output = (output + d).slice(-200_000); });
    child.on('error', e => { clearTimeout(timer); reject(new Error(`${command} could not start: ${e.message}`)); });
    child.on('close', code => { clearTimeout(timer); if (timedOut) reject(new Error(`${command} exceeded 90 seconds.`)); else resolve({ code, output }); });
  });
}
async function cleanup() {
  await fs.mkdir(buildRoot, { recursive: true });
  // Recover expired builds after a server restart, only inside our dedicated cache.
  for (const entry of await fs.readdir(buildRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^build-[a-zA-Z0-9]{6}$/.test(entry.name)) continue;
    const directory = path.join(buildRoot, entry.name);
    const stat = await fs.stat(directory).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > 20 * 60_000) await fs.rm(directory, { recursive: true, force: true });
  }
  for (const [id, build] of builds) if (Date.now() - build.created > 20 * 60_000 || builds.size > 10) {
    builds.delete(id); await fs.rm(build.directory, { recursive: true, force: true });
  }
}
const cleanupTimer = setInterval(() => { void cleanup().catch(() => {}); }, 60_000); cleanupTimer.unref();
export async function compileLatex(source, project, keepBuild = false) {
  const input = normalizeProject(source, project);
  await cleanup();
  const directory = await fs.mkdtemp(path.join(buildRoot, 'build-'));
  let retained = false, log = '', lastOutput = '';
  const steps = [];
  const execute = async (command, args) => {
    steps.push(command);
    const result = await run(command, args, directory);
    lastOutput = result.output; log += `\n=== ${command} ===\n${result.output}`;
    if (result.code !== 0) throw new Error(`${command} failed (exit ${result.code}).`);
  };
  const tex = () => execute(input.engine, ['--disable-write18', '--disable-installer', ...(input.engine === 'lualatex' ? [] : ['--dont-parse-first-line']), '--interaction=nonstopmode', '--halt-on-error', '--c-style-errors', '--synctex=1', '--job-name=md2pdf', ...(input.engine === 'lualatex' ? ['--nosocket'] : []), input.main]);
  try {
    for (const file of input.files) {
      const destination = path.join(directory, file.path);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, Buffer.from(file.content, file.encoding));
    }
    await tex();
    const exists = async name => !!(await fs.stat(path.join(directory, name)).catch(() => null));
    const aux = await fs.readFile(path.join(directory, 'md2pdf.aux'), 'utf8').catch(() => '');
    const bibliography = input.bibliography === 'auto' ? (await exists('md2pdf.bcf') ? 'biber' : /\\bibdata\{/.test(aux) ? 'bibtex' : 'off') : input.bibliography;
    if (bibliography !== 'off') await execute(bibliography, bibliography === 'biber' ? ['--input-directory', directory, '--output-directory', directory, 'md2pdf'] : ['md2pdf']);
    await tex();
    if (input.index && await exists('md2pdf.idx')) {
      const idx = await fs.readFile(path.join(directory, 'md2pdf.idx'), 'utf8');
      if (idx.trim()) await execute('makeindex', ['md2pdf.idx']);
    }
    await tex(); await tex();
    const pdf = await fs.readFile(path.join(directory, 'md2pdf.pdf'));
    let buildId;
    if (keepBuild) {
      buildId = randomUUID();
      builds.set(buildId, { directory, created: Date.now(), files: input.files.map(f => f.path) }); retained = true;
    }
    return { success: true, pdfBase64: pdf.toString('base64'), log, diagnostics: diagnostics(lastOutput), steps, buildId };
  } catch (error) {
    const issues = diagnostics(lastOutput);
    if (!issues.some(d => d.severity === 'error')) issues.push({ message: error.message, file: input.main, line: 1, severity: 'error' });
    return { success: false, log: log + '\n' + error.message, diagnostics: issues, steps };
  } finally { if (!retained) await fs.rm(directory, { recursive: true, force: true }); }
}
export function diagnostics(log) {
  return log.split(/\r?\n/).filter(line => /\.tex:\d+:|^!|Warning:|Overfull|Underfull|^ERROR|^FATAL/.test(line)).map(message => {
    const match = /(?:^|\()(.+?\.tex):(\d+):/.exec(message);
    return { message, file: match?.[1].replace(/^\.\//, ''), line: Number(match?.[2] || /lines? (\d+)/.exec(message)?.[1] || 1), severity: /\.tex:\d+:|^!|^ERROR|^FATAL/.test(message) ? 'error' : 'warning' };
  });
}
export async function syncLatex(query) {
  const build = builds.get(query.buildId);
  if (!build || Date.now() - build.created > 20 * 60_000) throw new Error('Preview expired. Compile again to use SyncTeX.');
  const pdf = path.join(build.directory, 'md2pdf.pdf');
  let args;
  if (query.direction === 'forward') {
    if (!build.files.includes(query.file)) throw new Error('Source file is not part of this build.');
    const line = Math.max(1, Math.floor(Number(query.line) || 1));
    args = ['view', '-i', `${line}:0:${path.join(build.directory, query.file)}`, '-o', pdf];
  } else if (query.direction === 'inverse') {
    if (![query.page, query.x, query.y].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) throw new Error('Invalid PDF position.');
    args = ['edit', '-o', `${Math.max(1, Math.floor(query.page))}:${query.x}:${query.y}:${pdf}`];
  } else throw new Error('Invalid synchronization direction.');
  const result = await run('synctex', args, build.directory);
  const records = result.output.split('SyncTeX result begin')[1]?.split('SyncTeX result end')[0] || '';
  const value = key => new RegExp(`^${key}:(.*)$`, 'm').exec(records)?.[1].trim();
  if (query.direction === 'forward') {
    if (!value('Page')) throw new Error('No PDF location for this source line. Try a line containing printed text.');
    return { page: Number(value('Page')), x: Number(value('x')), y: Number(value('y')) };
  }
  const file = value('Input');
  if (!file) throw new Error('No source location for this PDF position.');
  const relative = path.relative(build.directory, path.resolve(build.directory, file)).replaceAll('\\', '/');
  if (!build.files.includes(relative)) throw new Error('This PDF location refers to an installed package rather than project source.');
  return { file: relative, line: Number(value('Line')) || 1 };
}

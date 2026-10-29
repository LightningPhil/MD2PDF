// @vitest-environment node
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { defaultProject, projectPath, readLatexZip, writeLatexZip } from '../src/latex-project';
import { normalizeProject, safeProjectPath } from '../scripts/latex-compile.mjs';

describe('LaTeX project boundaries', () => {
  it.each(['../secret.tex', '/absolute.tex', 'C:/secret.tex', 'chapters/../secret.tex', 'chapter\\secret.tex', 'NUL.tex', 'file.tex:stream', 'folder//file.tex'])('rejects unsafe path %s on client and server', name => {
    expect(() => projectPath(name)).toThrow(); expect(() => safeProjectPath(name)).toThrow();
  });
  it('rejects duplicate and case-colliding source paths', () => {
    expect(() => normalizeProject('text', { files: [{ path: 'MAIN.tex', content: 'other', encoding: 'utf8' }] })).toThrow(/Duplicate/);
  });
  it('rejects missing main files and unsupported engines', () => {
    expect(() => normalizeProject('text', { main: 'missing.tex' })).toThrow(/main/);
    expect(() => normalizeProject('text', { engine: 'cmd.exe' })).toThrow(/engine/);
  });
  it('round-trips nested sources, assets and build settings without changing source', async () => {
    const project = { ...defaultProject(), engine: 'lualatex' as const, bibliography: 'biber' as const, files: [
      { path: 'chapters/intro.tex', content: '\\section{A}', encoding: 'utf8' as const },
      { path: 'images/asset.png', content: 'AQIDBA==', encoding: 'base64' as const },
    ] };
    const source = '\\documentclass{article}\n\\input{chapters/intro}';
    const loaded = await readLatexZip(await writeLatexZip(source, project));
    expect(loaded).toEqual({ source, project });
  });
  it('rejects traversal even when ZIP loading sanitizes a filename', async () => {
    const zip = new JSZip(); zip.file('../main.tex', '\\documentclass{article}');
    await expect(readLatexZip(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/path/);
  });
  it('imports standard project ZIPs without an application manifest', async () => {
    const zip = new JSZip(); zip.file('paper/main.tex', '\\documentclass{article}'); zip.file('refs.bib', '@book{x}');
    const loaded = await readLatexZip(await zip.generateAsync({ type: 'blob' }));
    expect(loaded.project.root).toBe('paper/main.tex'); expect(loaded.project.main).toBe('paper/main.tex'); expect(loaded.project.files[0].path).toBe('refs.bib');
  });
});

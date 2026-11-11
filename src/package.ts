import JSZip from 'jszip';
import { decodeDocument, encodeDocument, type DocumentSettings } from './document.js';
const imagePattern = /data:image\/(png|jpeg|gif|webp);base64,([a-zA-Z0-9+/=]+)/g;
const MiB = 1024 * 1024;
const maxExpanded = 50 * MiB;

/** Stop inflation at the limit rather than allocating the complete ZIP entry first. */
export function readPackageEntry(entry: JSZip.JSZipObject, limit: number): Promise<Uint8Array> {
  // JSZip exposes this public streaming API at runtime but omits it on JSZipObject's type.
  const stream = (entry as JSZip.JSZipObject & {
    internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
  }).internalStream('uint8array');
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0, failed = false;
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        failed = true; stream.pause(); chunks.length = 0;
        reject(new Error(`Package entry ${entry.name} exceeds its expanded size limit.`));
      } else if (!failed) chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      if (failed) return;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      resolve(bytes);
    });
    stream.resume();
  });
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}

export async function createPackage(content: string, filename: string, settings: DocumentSettings): Promise<Blob> {
  if (new TextEncoder().encode(content).length > maxExpanded) throw new Error('Keep packaged source below 50 MB.');
  const zip = new JSZip();
  const assets = new Map<string, string>();
  let count = 0;
  const portable = content.replace(imagePattern, (url: string, ext: string, base64: string) => {
    let name = assets.get(url);
    if (!name) {
      // Avoid replacing prose or existing URLs that happen to use our asset names.
      do { name = `assets/image-${++count}.${ext === 'jpeg' ? 'jpg' : ext}`; } while (content.includes(name));
      if (base64.length * 3 / 4 > 20 * MiB) throw new Error('A packaged image exceeds 20 MB.');
      assets.set(url, name); zip.file(name, base64, { base64: true });
      if (assets.size > 997) throw new Error('Keep packages below 998 distinct images.');
    }
    return name;
  });
  const safeFilename = filename.replace(/[\\/]/g, '_').replace(/\.(md|markdown)$/i, '') + '.md';
  const markdown = encodeDocument(portable, settings);
  if (new TextEncoder().encode(markdown).length > 20 * MiB) throw new Error('Keep packaged Markdown below 20 MB.');
  zip.file(safeFilename, markdown);
  zip.file('md2pdf-project.json', JSON.stringify({ version: 1, document: safeFilename }, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export async function readPackage(file: Blob): Promise<{ filename: string; content: string }> {
  if (file.size > 50 * MiB) throw new Error('Choose a package smaller than 50 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  if (Object.keys(zip.files).length > 1000) throw new Error('This package contains too many entries (maximum 1000).');
  const manifestFile = zip.file('md2pdf-project.json');
  if (!manifestFile) throw new Error('This ZIP is missing its MD2PDF project manifest.');
  const decoder = new TextDecoder();
  const manifest = JSON.parse(decoder.decode(await readPackageEntry(manifestFile, 64 * 1024)));
  if (!manifest || manifest.version !== 1 || typeof manifest.document !== 'string' || /(^|[\\/])\.\.([\\/]|$)/.test(manifest.document)) throw new Error('Unrecognized MD2PDF package format.');
  const markdown = zip.file(manifest.document);
  if (!markdown) throw new Error('The Markdown file in this package is missing.');
  const source = await readPackageEntry(markdown, 20 * MiB);
  let expanded = source.length;
  const document = decodeDocument(decoder.decode(source));
  let content = document.content;
  const replacements = new Map<string, string>();
  for (const name of Object.keys(zip.files).sort((a, b) => b.length - a.length)) {
    const extension = /\.(png|jpg|jpeg|gif|webp)$/i.exec(name)?.[1].toLowerCase();
    if (!extension || !name.startsWith('assets/') || !content.includes(name)) continue;
    const entry = zip.file(name);
    if (!entry) continue;
    const bytes = await readPackageEntry(entry, Math.min(20 * MiB, maxExpanded - expanded));
    expanded += bytes.length;
    const data = base64(bytes);
    const type = extension === 'jpg' ? 'jpeg' : extension;
    replacements.set(name, `data:image/${type};base64,${data}`);
  }
  if (replacements.size) {
    const escaped = [...replacements.keys()].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(?:${escaped.join('|')})(?![\\w./-])`, 'g');
    let length = content.length;
    // Estimate repeated embeds before allocating the expanded source.
    for (const match of content.matchAll(pattern)) {
      length += replacements.get(match[0])!.length - match[0].length;
      if (length > maxExpanded) throw new Error('The expanded document exceeds 50 MB.');
    }
    content = content.replace(pattern, name => replacements.get(name)!);
  }
  if (new TextEncoder().encode(content).length > maxExpanded) throw new Error('The expanded document exceeds 50 MB.');
  return { filename: manifest.document.split(/[\\/]/).pop() || 'Document.md', content: encodeDocument(content, document.settings) };
}

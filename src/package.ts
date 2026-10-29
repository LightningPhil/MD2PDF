import JSZip from 'jszip';
import { decodeDocument, encodeDocument, type DocumentSettings } from './document.js';
const imagePattern = /data:image\/(png|jpeg|gif|webp);base64,([a-zA-Z0-9+/=]+)/g;
export async function createPackage(content: string, filename: string, settings: DocumentSettings): Promise<Blob> {
  const zip = new JSZip();
  const assets = new Map<string, string>();
  let count = 0;
  const portable = content.replace(imagePattern, (url: string, ext: string, base64: string) => {
    let name = assets.get(url);
    if (!name) {
      name = `assets/image-${++count}.${ext === 'jpeg' ? 'jpg' : ext}`;
      assets.set(url, name); zip.file(name, base64, { base64: true });
    }
    return name;
  });
  const safeFilename = filename.replace(/[\\/]/g, '_').replace(/\.(md|markdown)$/i, '') + '.md';
  zip.file(safeFilename, encodeDocument(portable, settings));
  zip.file('md2pdf-project.json', JSON.stringify({ version: 1, document: safeFilename }, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export async function readPackage(file: Blob): Promise<{ filename: string; content: string }> {
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose a package smaller than 50 MB.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('md2pdf-project.json');
  if (!manifestFile) throw new Error('This ZIP is missing its MD2PDF project manifest.');
  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.version !== 1 || typeof manifest.document !== 'string') throw new Error('Unrecognized MD2PDF package format.');
  const markdown = zip.file(manifest.document);
  if (!markdown) throw new Error('The Markdown file in this package is missing.');
  const document = decodeDocument(await markdown.async('string'));
  let content = document.content;
  for (const name of Object.keys(zip.files)) {
    const extension = /\.(png|jpg|jpeg|gif|webp)$/i.exec(name)?.[1].toLowerCase();
    if (!extension || !name.startsWith('assets/') || !content.includes(name)) continue;
    const entry = zip.file(name)!;
    const data = await entry.async('base64');
    if (data.length > 28 * 1024 * 1024) throw new Error('A packaged image exceeds 20 MB.');
    const type = extension === 'jpg' ? 'jpeg' : extension;
    content = content.split(name).join(`data:image/${type};base64,${data}`);
  }
  return { filename: manifest.document.split(/[\\/]/).pop() || 'Document.md', content: encodeDocument(content, document.settings) };
}

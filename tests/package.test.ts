// @vitest-environment node
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createPackage, readPackage, readPackageEntry } from '../src/package';
import { DEFAULT_SETTINGS, decodeDocument } from '../src/document';

const blob = async (zip: JSZip) => new Blob([await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })]);
describe('portable packages', () => {
  it('round-trips text, metadata and deduplicated image data without asset-name collisions', async () => {
    const image = 'data:image/png;base64,aGVsbG8=';
    const content = `# Report\n\nMention assets/image-1.png in prose.\n\n![A](${image})\n\n<img src="${image}" alt="B">`;
    const settings = { ...DEFAULT_SETTINGS, pageSize: 'letter' as const, title: 'Evidence' };
    const archive = await createPackage(content, 'folder/Report.md', settings);
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    expect(Object.keys(zip.files).filter(name => name.endsWith('.png'))).toEqual(['assets/image-2.png']);
    const reopened = await readPackage(archive);
    expect(reopened.filename).toBe('folder_Report.md');
    expect(decodeDocument(reopened.content)).toEqual({ content, settings, hasSettings: true });
  });
  it('leaves remote URLs and unembedded source intact', async () => {
    const source = '![Remote](https://example.com/image.png)\n\nα and β';
    expect(decodeDocument((await readPackage(await createPackage(source, 'Note', DEFAULT_SETTINGS))).content).content).toBe(source);
  });
  it('rejects missing, null and unknown-version manifests and missing documents', async () => {
    await expect(readPackage(await blob(new JSZip().file('notes.md', 'text')))).rejects.toThrow('manifest');
    for (const manifest of [null, { version: 2, document: 'a.md' }, { version: 1, document: '../a.md' }]) {
      await expect(readPackage(await blob(new JSZip().file('md2pdf-project.json', JSON.stringify(manifest))))).rejects.toThrow('format');
    }
    await expect(readPackage(await blob(new JSZip().file('md2pdf-project.json', '{"version":1,"document":"a.md"}')))).rejects.toThrow('missing');
  });
  it('stops compressed-entry expansion at the configured bound', async () => {
    const zip = await JSZip.loadAsync(await (await blob(new JSZip().file('large.txt', 'x'.repeat(100000)))).arrayBuffer());
    await expect(readPackageEntry(zip.file('large.txt')!, 1000)).rejects.toThrow('expanded size limit');
    expect((await readPackageEntry(zip.file('large.txt')!, 100000)).length).toBe(100000);
  });
  it('rejects excessive entry counts before loading their data', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 1001; i++) zip.file(`entry-${i}`, '');
    await expect(readPackage(await blob(zip))).rejects.toThrow('too many entries');
  });
});

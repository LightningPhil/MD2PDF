import fs from 'node:fs/promises';
import path from 'node:path';
const manifest = JSON.parse(await fs.readFile('package.json', 'utf8'));
const visited = new Set();
const licenseChoices = new Map([
  ['MIT', 'MIT'], ['ISC', 'ISC'], ['Apache-2.0', 'Apache-2.0'],
  ['(MPL-2.0 OR Apache-2.0)', 'Apache-2.0'],
  ['(MIT OR GPL-3.0-or-later)', 'MIT'], ['(MIT AND Zlib)', 'MIT AND Zlib'],
]);
let notices = 'MD2PDF third-party notices\n\nThe application is MIT-licensed. Bundled libraries and fonts retain the licenses reproduced below.\nFor dual-licensed packages we use the permissive option stated in each heading; upstream license files are reproduced intact.\nDevelopment-only tools are not distributed in the website.\n';

// Resolve from the importing package so nested versions get their own notices.
async function resolvePackage(name, from) {
  let current = path.resolve(from);
  for (;;) {
    const folder = path.join(current, 'node_modules', name);
    try { await fs.access(path.join(folder, 'package.json')); return folder; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Cannot resolve runtime dependency ${name} from ${from}`);
    current = parent;
  }
}

async function collect(name, from = '.') {
  const folder = await resolvePackage(name, from);
  if (visited.has(folder)) return; visited.add(folder);
  const info = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8'));
  const selected = licenseChoices.get(info.license);
  if (!selected) throw new Error(`Review required: ${name} ${info.version} license ${info.license}`);
  notices += `\n\n${'='.repeat(72)}\n${name} ${info.version} — ${selected} (upstream: ${info.license})\n${'='.repeat(72)}\n`;
  const licenseFiles = (await fs.readdir(folder, { withFileTypes: true }))
    .filter(file => file.isFile() && /^(?:licen[cs]e|notice|copying)(?:[.-].*)?$/i.test(file.name))
    .map(file => file.name).sort();
  if (!licenseFiles.length) {
    // isarray 1.x ships its complete MIT notice in README.md only.
    const readme = await fs.readFile(path.join(folder, 'README.md'), 'utf8');
    const license = readme.match(/^## License\s*\n([\s\S]+)/m)?.[1];
    if (!license || !license.includes('Permission is hereby granted') || !license.includes('SOFTWARE.')) {
      throw new Error(`Missing license text for ${name} ${info.version}`);
    }
    notices += `\nREADME.md — License\n${license.trim()}\n`;
  }
  for (const file of licenseFiles) notices += `\n${file}\n${await fs.readFile(path.join(folder, file), 'utf8')}\n`;
  for (const dependency of Object.keys(info.dependencies || {}).sort()) await collect(dependency, folder);
}
for (const dependency of Object.keys(manifest.dependencies).sort()) await collect(dependency);
for (const file of ['katex-fonts-LICENSE.txt', 'pako-zlib-NOTICE.txt']) {
  notices += `\n\n${'='.repeat(72)}\n${file}\n${'='.repeat(72)}\n\n${await fs.readFile(new URL(`./licenses/${file}`, import.meta.url), 'utf8')}\n`;
}
await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/THIRD_PARTY_NOTICES.txt', notices);
await fs.copyFile('LICENSE', 'public/LICENSE.txt');
console.log(`Collected notices for ${visited.size} packages.`);

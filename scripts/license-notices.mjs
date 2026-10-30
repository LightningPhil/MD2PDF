import fs from 'node:fs/promises';
import path from 'node:path';
const manifest = JSON.parse(await fs.readFile('package.json', 'utf8'));
const visited = new Set();
let notices = 'MD2PDF third-party notices\n\nThe application is MIT-licensed. Bundled libraries and fonts retain the licenses reproduced below.\n';
async function collect(name) {
  if (visited.has(name)) return; visited.add(name);
  const folder = path.join('node_modules', name);
  const info = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8'));
  notices += `\n\n${'='.repeat(72)}\n${name} ${info.version} — ${info.license || 'see license text'}\n${'='.repeat(72)}\n`;
  const licenseFiles = (await fs.readdir(folder)).filter(file => /^(?:licen[cs]e|notice|copying)(?:[.-].*)?$/i.test(file));
  for (const file of licenseFiles) if ((await fs.stat(path.join(folder, file))).isFile()) notices += `\n${file}\n${await fs.readFile(path.join(folder, file), 'utf8')}\n`;
  if (!licenseFiles.length) notices += `License information: ${info.homepage || info.repository?.url || 'https://www.npmjs.com/package/' + name}\n`;
  for (const dependency of Object.keys(info.dependencies || {})) await collect(dependency);
}
for (const dependency of Object.keys(manifest.dependencies)) await collect(dependency);
await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/THIRD_PARTY_NOTICES.txt', notices);
await fs.copyFile('LICENSE', 'public/LICENSE.txt');
console.log(`Collected notices for ${visited.size} packages.`);

import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Traceability validation, not executable feature coverage. Run from repo root.
export const digest = source => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
export function scanCallables(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const records = [];
  function visit(node, owner = '') {
    let nextOwner = owner;
    if (ts.isClassDeclaration(node) && node.name) nextOwner = node.name.text;
    const callable = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
      || ts.isConstructorDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node);
    if (callable && node.body) {
      const location = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      const line = location.line + 1, column = location.character + 1;
      let name = node.name?.getText(tree);
      if (ts.isConstructorDeclaration(node)) name = 'constructor';
      if (!name && (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent))) name = node.parent.name.getText(tree);
      const anonymous = !name;
      name ||= `callback@${line}:${column}`;
      const symbol = owner ? `${owner}.${name}` : name;
      records.push({ key: `${file}:${line}:${column}`, file, line, column, kind: ts.SyntaxKind[node.kind], symbol, owner, anonymous });
      nextOwner = symbol;
    }
    ts.forEachChild(node, child => visit(child, nextOwner));
  }
  visit(tree);
  return records;
}

export function repositoryFiles() {
  return [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean))].sort();
}

export async function validate() {
  const inventory = JSON.parse(await readFile('docs/audit/coverage.json', 'utf8'));
  const catalogue = await readFile('docs/USE_CASES.md', 'utf8');
  const matrix = await readFile('docs/FEATURE_COVERAGE.md', 'utf8');
  const review = await readFile('docs/CODE_REVIEW.md', 'utf8');
  const liveReview = await readFile('docs/LIVE_REVIEW.md', 'utf8');
  const liveResults = JSON.parse(await readFile('docs/audit/live-results.json', 'utf8'));
  const manual = await readFile('MANUAL_TESTING.md', 'utf8');
  const errors = [];
  const storySections = [...catalogue.matchAll(/^### (UC-\d{2}) ([^\n]+)\n([\s\S]*?)(?=^### UC-|^## |$(?![\s\S]))/gm)];
  const stories = new Set(storySections.map(match => match[1]));
  for (const match of storySections) {
    if (!/\*\*User story:\*\* As .+I want.+so that/.test(match[3])) errors.push(`${match[1]} lacks a complete user story`);
    for (const field of ['Trigger and precondition','Workflow','Acceptance','Current behaviour']) if (!match[3].includes(`**${field}:**`)) errors.push(`${match[1]} lacks ${field}`);
  }
  if (stories.size !== storySections.length) errors.push('Duplicate use case IDs');
  const reviewed = [...review.matchAll(/^\| (UC-\d{2}) —/gm)].map(match => match[1]);
  const liveReviewed = [...liveReview.matchAll(/^\| (UC-\d{2}) —/gm)].map(match => match[1]);
  for (const id of stories) {
    if (reviewed.filter(row => row === id).length !== 1) errors.push(`${id} must have exactly one code-review verdict`);
    if (liveReviewed.filter(row => row === id).length !== 1) errors.push(`${id} must have exactly one live-review verdict`);
    if (!liveResults.some(result => result.ids?.includes(id))) errors.push(`${id} has no recorded live observation`);
    if (!manual.includes(id)) errors.push(`${id} is absent from the live campaign`);
  }
  for (const id of [...reviewed, ...liveReviewed, ...liveResults.flatMap(result => result.ids || [])]) if (!stories.has(id)) errors.push(`Unknown reviewed story ${id}`);
  const refs = text => [...new Set(text.match(/UC-\d{2}/g) || [])];
  const features = matrix.split('\n').filter(line=>/^\| F-\d{3} \|/.test(line));
  const featureIds = new Set();
  for (const row of features) {
    const id = row.match(/F-\d{3}/)[0];
    if (featureIds.has(id)) errors.push(`Duplicate feature ${id}`);
    featureIds.add(id);
    if (!refs(row).length) errors.push(`${id} has no use case`);
    for (const id of refs(row)) if (!stories.has(id)) errors.push(`Unknown use case ${id}`);
  }
  for (const id of stories) if (!features.some(row=>refs(row).includes(id))) errors.push(`${id} is absent from feature matrix`);
  if (features.length !== inventory.features.length) errors.push('Feature inventory count changed');
  for (const row of features) {
    const id = row.match(/F-\d{3}/)[0];
    const recorded = inventory.features.find(feature=>feature.id===id);
    if (!recorded || JSON.stringify(refs(row))!==JSON.stringify(recorded.useCases)) errors.push(`Feature mapping changed: ${id}`);
  }
  const files = repositoryFiles();
  const fileMap = new Map(inventory.files.map(file=>[file.path,file]));
  for (const file of files) if (!fileMap.has(file)) errors.push(`Unmapped repository file: ${file}`);
  for (const file of fileMap.keys()) if (!files.includes(file)) errors.push(`Inventory file no longer present: ${file}`);
  for (const item of [...inventory.files,...inventory.callables]) {
    if (!item.useCases?.length) errors.push(`Missing association: ${item.path || item.key}`);
    for (const id of item.useCases || []) if (!stories.has(id)) errors.push(`Unknown ${id} on ${item.path || item.key}`);
  }
  const callableFiles = files.filter(file=>/\.(?:ts|js|mjs)$/.test(file) && !file.endsWith('.d.ts'));
  const current = [];
  for (const file of callableFiles) {
    const source = await readFile(file,'utf8');
    if (inventory.sourceHashes[file] !== digest(source)) errors.push(`Source snapshot changed: ${file}`);
    current.push(...scanCallables(file,source));
  }
  const expected = new Map(inventory.callables.map(item=>[item.key,item]));
  if (expected.size !== inventory.callables.length) errors.push('Duplicate callable keys');
  for (const item of current) {
    const recorded = expected.get(item.key);
    if (!recorded || recorded.symbol !== item.symbol || recorded.kind !== item.kind) errors.push(`Unmapped/changed callable: ${item.key} ${item.symbol}`);
  }
  if (current.length !== inventory.callables.length) errors.push(`Callable count differs: ${current.length} vs ${inventory.callables.length}`);
  for (const file of await readdir('docs')) {
    if (!file.endsWith('.md')) continue;
    const text = await readFile(`docs/${file}`,'utf8');
    for (const link of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = link[1].split('#')[0];
      if (!target || /^[a-z]+:/.test(target)) continue;
      try { await readFile(path.resolve('docs',target)); } catch { errors.push(`Broken link in ${file}: ${target}`); }
    }
  }
  const runtime = current.filter(item=>item.file.startsWith('src/'));
  console.log(JSON.stringify({useCases:stories.size,features:features.length,repositoryFiles:files.length,runtimeCallables:runtime.length,totalCallables:current.length,unmappedOrInvalid:errors.length},null,2));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await validate();

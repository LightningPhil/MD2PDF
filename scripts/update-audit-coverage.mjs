import {readFile, writeFile} from 'node:fs/promises';
import {scanCallables, digest, repositoryFiles} from './check-audit-coverage.mjs';

// Review these ownership mappings before regenerating. Associations express
// responsibility, not executed acceptance or statement/branch coverage.

const uc = (...numbers)=>numbers.map(n=>`UC-${String(n).padStart(2,'0')}`);
const specs = {};
function spec(file, defaults, groups) {
  const methods = {};
  for (const [names,ids] of groups) for (const name of names.split(' ')) methods[name]=uc(...ids);
  specs[`src/${file}.ts`]={defaults:uc(...defaults),methods};
}
spec('authoring',[10,12,14],[['formatSelection',[10,11,28]],['equationAt',[14]],['constructor',[10,12,14,30]],['open commit',[12,14]],['updatePreview',[13,14]]]);
spec('browser-print',[32,33,34],[['prepareBrowserPrint',[31,32,33,34,39]],['cleanup',[34]]]);
spec('dialog',[14,15,16,19,30],[['makeDialog showDialog',[6,7,14,15,16,19,30]],['requestFilename',[6,30]],['confirmDocumentClose',[7,30]],['dialogError',[6,14,15,16,19,31]],['downloadBlob',[6,9]]]);
spec('document',[6,19,20],[['bounded normalizeSettings',[6,8,20]],['decodeDocument encodeDocument',[2,6,9]],['applyDocumentStyle',[19,20,32]],['escapeHtml',[16,35]],['validLabel',[14,15,16,18]]]);
spec('editor',[1,10,28],[['constructor setupEventListeners',[1,11,28,30]],['getContent getSelection setSelection getSelectedText focus',[10,14,15,16,26,27]],['setContent setDocumentKey forgetDocumentHistory',[2,5,7,8,28]],['onChange notifyChange',[1,10]],['removeChangeListener clear wrapSelection',[10,28,38,39]],['insertText replaceRange',[10,11,14,15,16,24,27,28]],['undo redo snapshot recordHistory restoreHistory',[28]]]);
spec('katex',[12,14,35,39],[['decodeHtmlEntities decodeMathPayload',[12,14,35]],['renderMath getTextNodes',[11,12,14,35,39]]]);
spec('layout-tools',[19,20,21,22,23],[['constructor open input fill read',[19,20,21,22,23]],['refreshPresetOptions persistPresets',[19]]]);
spec('main',[1,5,8],[['constructor',[1,8,13,19,35]],['setupEventHandlers',[2,5,6,7,8,20,32,33,39]],['initializeDocuments createDocument createDocumentId nextUntitledFilename',[1,2,5]],['addUploadedDocuments',[2,9]],['switchActiveDocument getActiveDocument getDocumentById syncActiveDocumentContentFromEditor',[5,8]],['renameDocument makeUniqueFilename ensureMarkdownFilename pathExtension',[2,6,39]],['closeDocument',[7]],['renderActiveDocument',[1,20,24,26]],['recomputeInactivePageCounts calculatePageCountForMarkdown refreshDocumentList',[5,20,24]],['buildExportModalContext exportDocuments',[32,33,34]],['showError',[2,8,31,34]],['restoreWorkspace scheduleSave flushSave',[8]],['warmImages',[16,17,24]],['checkOutput',[31]]]);
spec('markdown',[10,12,18,24,35],[['createMathToken encodeMathForDataAttribute',[12,14]],['displayMathExtension inlineMathExtension start tokenizer renderer',[12,18,24]],['ensureMarkedConfigured renderMarkdown',[10,11,12,18,24,35,36]],['decorateDocument',[18,21,22]],['register',[18]]]);
spec('media-tools',[15,16,17],[['tableAt tableMarkdown openTable drawGrid',[15]],['constructor',[15,16,17,30]],['openImage loadImage previewImage',[16,17]]]);
spec('navigation',[26,27],[['sourceOffsetY',[26]],['constructor',[14,15,16,26,27,29,30]],['refresh',[22,26,27]],['openFind updateMatches find',[27]],['goTo mappedBlocks measureOffset highlight schedule syncFromEditor syncFromPreview',[26]]]);
spec('package',[9],[['createPackage readPackage',[9]]]);
spec('pages',[20,24,25],[['constructor updatePages clearPages paginateContent',[24,25]],['setMathMode getMathMode',[12,25,39]],['setSettings',[20,21,22,23]],['getPageCount calculatePageCount',[5,24]],['displayPages',[21,22,23,24]],['getPageContentHeightPx getPageHeightMm getPageMarginMm mmToPx',[20,24]]]);
spec('paginator',[24],[['isAtomicElement',[11,15,16,24]],['createListFragment splitListByItems',[11,24]],['mapSplitSource',[24,26]],['createMeasureContainer getCssNumericValue',[20,24]]]);
spec('preflight',[31],[['waitForImages',[17,31,32]],['inspectOutput',[14,17,18,23,24,31]]]);
spec('storage',[8],[['validateWorkspace constructor load save',[8]]]);
spec('visual-math',[13],[['installVisualMath',[13,14,30]]]);
spec('workspace-tools',[1,9,19,26,31],[['constructor',[1,9,15,16,18,19,24,26,27,29,31]],['refresh',[26]],['setStatus',[8,9]],['updateSyncButton',[26]],['refreshExportChecks showIssues showChecks',[31]],['openReferences',[18]]]);
spec('ui',[2,5,6,20,25,29,30,32,33,34],[['constructor requireElement',[1,25,29,30,32]],['onFileUpload isMarkdownFile readFiles readSingleFile setupDragAndDrop',[2]],['onFileSave downloadFile',[6]],['onDocumentSelect renderDocumentList',[5,6,7]],['onDocumentRename',[6]],['onDocumentClose',[7]],['onSettingsChange getPageSize getPageSizeSpec getFontSize getMargin setDocumentPageSettings applySettings',[20]],['onExportContextRequest onExportStart openExportModal normalizeExportContext applyExportContext getSelectedExportScope',[32,33,34]],['dismissExportDialog closeExportModal setExportBusy setExportSummary',[34]],['resetExportPanel',[32,33,34]],['restoreWorkspaceLayout',[8,29]],['refreshPreviewViewport getViewportPaddingPx getViewportInnerSizePx calculateFitWidthZoom calculateFitPageZoom applyPreviewZoom getBasePageSizePx getBaseCanvasSizePx updatePreviewControlState roundZoom mmToPx clamp',[25]],['initializeTheme applyTheme toggleTheme',[29]],['toggleSidebar updateSidebarToggleButton',[5,29]],['onDividerPointerMove onDividerPointerUp startDividerDrag handleDividerKeyboard updateSplitFromPointerX setSplitPercent isStackedLayout',[29,30]],['showNotification',[2,6,7,8,30,34]],['setupEventListeners',[2,5,6,20,25,29,30,32,33,34,39]]]);

const extra=['docs/FUNCTION_COVERAGE.md','docs/audit/coverage.json'];
const files=[...new Set([...repositoryFiles(),...extra])].sort();
const sourceHashes={}, callables=[];
function association(file, entry) {
  const specification=specs[file];
  if (!specification) {
    if (file.startsWith('src/')) throw new Error(`Review and map new runtime module: ${file}`);
    return uc(38);
  }
  const segments=entry.symbol.split('.');
  for (let index=segments.length-1;index>=0;index--) if (specification.methods[segments[index]]) return specification.methods[segments[index]];
  return specification.defaults;
}
function classification(entry) {
  if (!entry.file.startsWith('src/')) return 'verification or build support';
  if (entry.file==='src/editor.ts' && /removeChangeListener|wrapSelection|\.clear$/.test(entry.symbol)) return 'helper API without current UI call';
  return entry.anonymous ? 'callback within owning workflow' : 'application implementation';
}
for (const file of files.filter(f=>/\.(?:ts|js|mjs)$/.test(f)&&!f.endsWith('.d.ts'))) {
  const source=await readFile(file,'utf8'); sourceHashes[file]=digest(source);
  for (const entry of scanCallables(file,source)) callables.push({...entry,useCases:association(file,entry),classification:classification(entry)});
}
const matrix=await readFile('docs/FEATURE_COVERAGE.md','utf8');
const features=matrix.split('\n').filter(line=>/^\| F-\d{3} \|/.test(line)).map(line=>({id:line.match(/F-\d{3}/)[0],capability:line.split('|')[2].trim(),useCases:[...new Set(line.match(/UC-\d{2}/g)||[])]}));
const fileRecords=files.map(file=>{
  let useCases=[...new Set(callables.filter(c=>c.file===file).flatMap(c=>c.useCases))];
  if (!useCases.length) {
    if(file==='style.css'||file==='index.html') useCases=uc(1,10,11,15,16,19,20,21,22,23,24,25,26,29,30,31,32,33,34,39);
    else if(file==='README.md'||file==='MANUAL_TESTING.md'||file==='ProjectPlan.md'||file==='todonowPRD.md'||file==='todo.md'||file==='temp.md'||file==='project-setup.json') useCases=uc(2,32,38,39);
    else if(file.startsWith('samples/')) useCases=uc(2,12,24,38);
    else if(file.startsWith('docs/audit/fixtures/engineering-note')) useCases=uc(1,6,9,32,37,38);
    else if(file.startsWith('docs/audit/fixtures/research-update')) useCases=uc(3,6,9,32,36,38);
    else if(file.startsWith('docs/audit/fixtures/method-handout')) useCases=uc(4,6,9,11,24,32,38);
    else useCases=uc(38);
  }
  return {path:file,useCases:useCases.sort(),category:file.startsWith('src/')?'runtime':file==='index.html'||file==='style.css'?'user interface':file.startsWith('tests/')?'verification':file.startsWith('docs/')?'audit deliverable':'repository support'};
});
const inventory={schemaVersion:1,date:'2026-11-06',baselineCommit:'10aa70fdd2361587b32b33586a822d344a9700f2',method:'AST enumeration of every executable function declaration, function expression, arrow, method, constructor and accessor in first-party source/test/script/config files. Callbacks inherit the nearest mapped owning symbol unless a specific name mapping applies. Associations express use-case responsibility, not executed test coverage. Types without bodies belong to their file workflow.',sourceHashes,features,files:fileRecords,callables};
await writeFile('docs/audit/coverage.json',JSON.stringify(inventory,null,2)+'\n');
const runtime=callables.filter(c=>c.file.startsWith('src/'));
let md='# MD2PDF function and repository coverage\n\n';
md+=`Working-tree snapshot after code repairs; original baseline: \`${inventory.baselineCommit}\`. Date: 6 November 2026.\n\n`;
md+=`**39 user stories; ${features.length} capability groups; ${runtime.length} application callables; ${callables.length} total first-party callables; ${files.length} repository files. Every item has at least one use-case association.**\n\n`;
md+='This is traceability coverage, not statement/branch coverage or proof that all acceptance criteria pass. The [live review](LIVE_REVIEW.md) records browser evidence and remaining checks; the [code review](CODE_REVIEW.md) and [audit](AUDIT.md) retain earlier findings. Read the [stories](USE_CASES.md) and [capability matrix](FEATURE_COVERAGE.md) before this implementation appendix.\n\n';
md+='## Inventory method\n\nThe TypeScript parser enumerates executable function declarations, expressions, arrows, methods, constructors, and accessors, including anonymous event handlers. Declarations and interfaces without bodies are covered by their owning file. No dependency, generated build, temporary output, Git internal, or user-data files are included. Repository support includes tests, configuration, scripts, sample content, licenses, and contributor instructions.\n\nNamed functions have workflow mappings; callbacks inherit their nearest mapped owner unless a more specific mapping applies. Shared constructors and event-wiring methods can serve several stories. The JSON preserves a unique file/line/column key for every callable, including repeated callback names. Dormant helpers are explicitly identified; obsolete SVG and export-job controls have been removed.\n\nRun `node scripts/check-audit-coverage.mjs` from the repository root to detect missing stories, mappings, changed source hashes, missing/new functions, unaccounted files, and broken local documentation links. After source changes, review the ownership mappings in `scripts/update-audit-coverage.mjs`, run that generator, and rerun the validator. New runtime modules require explicit mappings. Passing traceability checks does not run the use cases.\n\n';
md+='## Application modules\n\n| Module | Named callables | Anonymous callbacks | Use cases |\n| --- | --- | --- | --- |\n';
for(const file of Object.keys(specs).sort()) {
  const entries=runtime.filter(c=>c.file===file), ids=[...new Set(entries.flatMap(c=>c.useCases))].sort();
  md+=`| [${file}](../${file}) | ${entries.filter(c=>!c.anonymous).length} | ${entries.filter(c=>c.anonymous).length} | ${ids.join(', ')} |\n`;
}
md+='\n## Every application callable\n\nLine and column identify the audited source snapshot. Each entry has at least one story; shared callbacks can have several.\n\n| Source location | Symbol | Use cases | Classification |\n| --- | --- | --- | --- |\n';
for(const c of runtime) md+=`| ${c.file}:${c.line}:${c.column} | \`${c.symbol.replaceAll('|','\\|')}\` | ${c.useCases.join(', ')} | ${c.classification} |\n`;
md+='\n## Verification and build callables\n\nThese implement UC-38. Application acceptance is additionally connected through the feature matrix. The JSON lists each callable individually.\n\n| File | Callables | Use case |\n| --- | --- | --- |\n';
for(const file of [...new Set(callables.filter(c=>!c.file.startsWith('src/')).map(c=>c.file))]) md+=`| [${file}](../${file}) | ${callables.filter(c=>c.file===file).length} | UC-38 |\n`;
md+='\n## Every repository file\n\nThis includes audit additions and all non-ignored tracked/untracked project files present at completion. Support files are associated with maintenance, rather than fabricated end-user controls.\n\n| File | Category | Use cases |\n| --- | --- | --- |\n';
for(const file of fileRecords) md+=`| [${file.path}](../${file.path}) | ${file.category} | ${file.useCases.join(', ')} |\n`;
await writeFile('docs/FUNCTION_COVERAGE.md',md);
console.log(JSON.stringify({runtimeCallables:runtime.length,totalCallables:callables.length,repositoryFiles:files.length,capabilities:features.length},null,2));

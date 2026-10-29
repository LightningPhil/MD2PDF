import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { WorkspaceStore, validateWorkspace, type WorkspaceState } from '../src/storage';
import { DEFAULT_SETTINGS } from '../src/document';
describe('workspace recovery', () => {
  const state: WorkspaceState = { version: 1, documents: [{ id: 'one', filename: 'Report.md', content: '# Recovered', pageCount: 2, settings: { ...DEFAULT_SETTINGS, title: 'Remember me' }, cursor: { start: 4, end: 6, scrollTop: 100 } }], activeDocumentId: 'one', untitledCounter: 3, split: '62%', sidebarCollapsed: true, syncScroll: false };
  it('persists documents, selection, layout and style in IndexedDB', async () => {
    await new WorkspaceStore().save(state);
    const recovered = await new WorkspaceStore().load();
    expect(recovered).toEqual({ ...state, documents: [{ ...state.documents[0], pageCount: 1 }] });
  });
  it('recovers valid documents when a workspace contains malformed entries', () => {
    const recovered = validateWorkspace({ ...state, activeDocumentId: 'gone', split: 'bad', documents: [state.documents[0], null, { id: 'bad' }, state.documents[0]] });
    expect(recovered!.documents).toHaveLength(1); expect(recovered!.activeDocumentId).toBe('one'); expect(recovered!.split).toBe('50%');
  });
  it('rejects unknown workspace versions', () => { expect(validateWorkspace({ ...state, version: 7 })).toBeNull(); });
});

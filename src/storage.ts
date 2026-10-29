import type { LatexProject } from './latex-project.js';
import { normalizeSettings, type DocumentSettings } from './document.js';
export interface StoredDocument {
  id: string; filename: string; content: string; pageCount: number; settings: DocumentSettings;
  latexProject?: LatexProject;
  cursor: { start: number; end: number; scrollTop: number };
}
export interface WorkspaceState {
  version: 1; documents: StoredDocument[]; activeDocumentId: string | null; untitledCounter: number;
  split: string; sidebarCollapsed: boolean; syncScroll: boolean;
}
export function validateWorkspace(value: unknown): WorkspaceState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as WorkspaceState;
  if (raw.version !== 1 || !Array.isArray(raw.documents)) return null;
  const ids = new Set<string>();
  const documents = raw.documents.filter(doc => {
    if (!doc || typeof doc.id !== 'string' || typeof doc.filename !== 'string' || typeof doc.content !== 'string' || ids.has(doc.id)) return false;
    ids.add(doc.id); return true;
  }).map(doc => ({ ...doc, pageCount: 1, settings: normalizeSettings(doc.settings), cursor: {
    start: Math.min(doc.content.length, Math.max(0, Number(doc.cursor?.start) || 0)),
    end: Math.min(doc.content.length, Math.max(0, Number(doc.cursor?.end) || 0)),
    scrollTop: Math.max(0, Number(doc.cursor?.scrollTop) || 0),
  } }));
  return { version: 1, documents, activeDocumentId: documents.some(d => d.id === raw.activeDocumentId) ? raw.activeDocumentId : documents[0]?.id ?? null,
    untitledCounter: Math.max(1, Number(raw.untitledCounter) || 1), split: /^\d+(\.\d+)?%$/.test(raw.split) ? raw.split : '50%', sidebarCollapsed: !!raw.sidebarCollapsed, syncScroll: raw.syncScroll !== false };
}
export class WorkspaceStore {
  private db: Promise<IDBDatabase>;
  constructor() {
    this.db = new Promise((resolve, reject) => {
      const request = indexedDB.open('md2pdf-workspace', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async load(): Promise<WorkspaceState | null> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const request = db.transaction('workspace').objectStore('workspace').get('current');
      request.onsuccess = () => resolve(validateWorkspace(request.result));
      request.onerror = () => reject(request.error);
    });
  }
  async save(state: WorkspaceState): Promise<void> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      tx.objectStore('workspace').put(state, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Local save was interrupted'));
    });
  }
}

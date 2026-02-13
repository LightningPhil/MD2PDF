/**
 * DocumentService - Manages document state for the MD2PDF application.
 * 
 * Pure state management service. Does not interact with UI, editor, or rendering.
 * Orchestration logic (switching documents, updating editor, etc.) remains in main.ts.
 */

import type { ManagedDocument } from '../types/document.js';
import type { UploadedMarkdownFile } from '../types/index.js';
import { EventEmitter } from '../utils/event-emitter.js';

/**
 * Events emitted by DocumentService.
 */
export type DocumentServiceEvents = {
  /** A document was added */
  'document:added': { document: ManagedDocument };
  /** A document was removed */
  'document:removed': { documentId: string; removedIndex: number };
  /** A document was renamed */
  'document:renamed': { documentId: string; oldFilename: string; newFilename: string };
  /** The active document changed */
  'active:changed': { documentId: string | null; previousId: string | null };
  /** Document content was updated */
  'content:updated': { documentId: string };
};

/**
 * Result of adding uploaded files.
 */
export interface AddDocumentsResult {
  addedDocuments: ManagedDocument[];
  firstDocumentId: string | null;
}

/**
 * Result of closing a document.
 */
export interface CloseDocumentResult {
  closed: ManagedDocument | null;
  closedIndex: number;
  nextActiveId: string | null;
  isEmpty: boolean;
}

/**
 * Service for managing document state.
 */
export class DocumentService {
  private documents: ManagedDocument[] = [];
  private activeDocumentId: string | null = null;
  private untitledCounter = 1;

  public readonly events = new EventEmitter<DocumentServiceEvents>();

  /**
   * Get all documents.
   */
  getAll(): readonly ManagedDocument[] {
    return this.documents;
  }

  /**
   * Get document count.
   */
  getCount(): number {
    return this.documents.length;
  }

  /**
   * Check if there are any documents.
   */
  isEmpty(): boolean {
    return this.documents.length === 0;
  }

  /**
   * Get the active document's ID.
   */
  getActiveId(): string | null {
    return this.activeDocumentId;
  }

  /**
   * Get the active document.
   */
  getActive(): ManagedDocument | undefined {
    if (!this.activeDocumentId) {
      return undefined;
    }
    return this.documents.find((doc) => doc.id === this.activeDocumentId);
  }

  /**
   * Get a document by ID.
   */
  getById(documentId: string): ManagedDocument | undefined {
    return this.documents.find((doc) => doc.id === documentId);
  }

  /**
   * Set the active document ID.
   */
  setActiveId(documentId: string | null): void {
    const previousId = this.activeDocumentId;
    if (documentId === previousId) {
      return;
    }

    // Validate the document exists if not null
    if (documentId !== null && !this.getById(documentId)) {
      return;
    }

    this.activeDocumentId = documentId;
    this.events.emit('active:changed', { documentId, previousId });
  }

  /**
   * Update the content of a document.
   */
  updateContent(documentId: string, content: string): boolean {
    const doc = this.getById(documentId);
    if (!doc) {
      return false;
    }

    doc.content = content;
    this.events.emit('content:updated', { documentId });
    return true;
  }

  /**
   * Update the page count of a document.
   */
  updatePageCount(documentId: string, pageCount: number): boolean {
    const doc = this.getById(documentId);
    if (!doc) {
      return false;
    }

    doc.pageCount = pageCount;
    return true;
  }

  /**
   * Create a new document.
   */
  createDocument(filename: string, content: string): ManagedDocument {
    return {
      id: this.createDocumentId(),
      filename,
      content,
      pageCount: 1,
    };
  }

  /**
   * Add a document to the collection.
   */
  addDocument(document: ManagedDocument): void {
    this.documents.push(document);
    this.events.emit('document:added', { document });
  }

  /**
   * Add uploaded files as documents.
   * Returns the added documents and the ID of the first one (for switching).
   */
  addUploadedFiles(files: UploadedMarkdownFile[]): AddDocumentsResult {
    if (files.length === 0) {
      return { addedDocuments: [], firstDocumentId: null };
    }

    const addedDocuments: ManagedDocument[] = [];
    files.forEach((file) => {
      const uniqueName = this.makeUniqueFilename(file.filename);
      const document = this.createDocument(uniqueName, file.content);
      this.documents.push(document);
      addedDocuments.push(document);
      this.events.emit('document:added', { document });
    });

    return {
      addedDocuments,
      firstDocumentId: addedDocuments.length > 0 ? addedDocuments[0].id : null,
    };
  }

  /**
   * Rename a document.
   */
  renameDocument(documentId: string, requestedFilename: string): { success: boolean; error?: string; newName?: string } {
    const target = this.getById(documentId);
    if (!target) {
      return { success: false, error: 'Document not found' };
    }

    const trimmed = (requestedFilename || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Filename cannot be empty' };
    }

    const normalized = this.ensureMarkdownFilename(trimmed);
    const unique = this.makeUniqueFilename(normalized, target.id);
    
    if (unique === target.filename) {
      return { success: true, newName: unique };
    }

    const oldFilename = target.filename;
    target.filename = unique;
    this.events.emit('document:renamed', { documentId, oldFilename, newFilename: unique });
    
    return { success: true, newName: unique };
  }

  /**
   * Remove a document by ID.
   * Returns information needed for orchestration (closed doc, next active, etc.)
   */
  removeDocument(documentId: string): CloseDocumentResult {
    const closingIndex = this.documents.findIndex((doc) => doc.id === documentId);
    if (closingIndex < 0) {
      return { closed: null, closedIndex: -1, nextActiveId: null, isEmpty: this.isEmpty() };
    }

    const closedDocument = this.documents[closingIndex];
    const wasActive = closedDocument.id === this.activeDocumentId;
    
    this.documents.splice(closingIndex, 1);
    this.events.emit('document:removed', { documentId, removedIndex: closingIndex });

    let nextActiveId: string | null = null;
    
    if (this.documents.length === 0) {
      this.activeDocumentId = null;
      this.events.emit('active:changed', { documentId: null, previousId: closedDocument.id });
    } else if (wasActive) {
      const replacementIndex = Math.min(closingIndex, this.documents.length - 1);
      const replacement = this.documents[replacementIndex];
      nextActiveId = replacement.id;
      this.activeDocumentId = nextActiveId;
      this.events.emit('active:changed', { documentId: nextActiveId, previousId: closedDocument.id });
    } else {
      // Keep current active document
      nextActiveId = this.activeDocumentId;
    }

    return {
      closed: closedDocument,
      closedIndex: closingIndex,
      nextActiveId,
      isEmpty: this.documents.length === 0,
    };
  }

  /**
   * Clear all documents.
   */
  clear(): void {
    const previousActive = this.activeDocumentId;
    this.documents = [];
    this.activeDocumentId = null;
    
    if (previousActive !== null) {
      this.events.emit('active:changed', { documentId: null, previousId: previousActive });
    }
  }

  /**
   * Generate the next untitled filename.
   */
  nextUntitledFilename(): string {
    const filename = this.untitledCounter === 1 ? 'Untitled.md' : `Untitled-${this.untitledCounter}.md`;
    this.untitledCounter += 1;
    return filename;
  }

  /**
   * Create a unique filename, avoiding collisions with existing documents.
   */
  makeUniqueFilename(requestedFilename: string, excludeDocumentId: string | null = null): string {
    const normalized = this.ensureMarkdownFilename(requestedFilename || this.nextUntitledFilename());

    const extension = this.pathExtension(normalized);
    const stem = normalized.slice(0, normalized.length - extension.length);

    let candidate = normalized;
    let counter = 1;

    const used = new Set(
      this.documents
        .filter((doc) => doc.id !== excludeDocumentId)
        .map((doc) => doc.filename.toLowerCase()),
    );
    
    while (used.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${stem} (${counter})${extension}`;
    }

    return candidate;
  }

  /**
   * Ensure filename has a markdown extension.
   */
  ensureMarkdownFilename(filename: string): string {
    const trimmed = (filename || '').trim();
    if (!trimmed) {
      return this.nextUntitledFilename();
    }

    if (/\.(md|markdown)$/i.test(trimmed)) {
      return trimmed;
    }

    return `${trimmed}.md`;
  }

  /**
   * Convert markdown filename to PDF filename.
   */
  toPdfFilename(filename: string): string {
    const markdownName = this.ensureMarkdownFilename(filename);
    const extension = this.pathExtension(markdownName);
    const stem = markdownName.slice(0, markdownName.length - extension.length);
    return `${stem}.pdf`;
  }

  /**
   * Build document list items for UI display.
   */
  toListItems(): { id: string; filename: string; pageCount: number; isActive: boolean }[] {
    return this.documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      pageCount: doc.pageCount,
      isActive: doc.id === this.activeDocumentId,
    }));
  }

  /**
   * Generate a unique document ID.
   */
  private createDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Extract the extension from a filename.
   */
  private pathExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === filename.length - 1) {
      return '.md';
    }
    return filename.slice(dotIndex);
  }
}

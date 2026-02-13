import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../src/services/document-service';
import type { ManagedDocument } from '../src/types/document';

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    service = new DocumentService();
  });

  describe('initial state', () => {
    it('starts with no documents', () => {
      expect(service.getAll()).toHaveLength(0);
      expect(service.isEmpty()).toBe(true);
      expect(service.getCount()).toBe(0);
    });

    it('has no active document initially', () => {
      expect(service.getActiveId()).toBeNull();
      expect(service.getActive()).toBeUndefined();
    });
  });

  describe('createDocument', () => {
    it('creates a document with UUID', () => {
      const doc = service.createDocument('test.md', '# Hello');
      expect(doc.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(doc.filename).toBe('test.md');
      expect(doc.content).toBe('# Hello');
      expect(doc.pageCount).toBe(1);
    });

    it('generates unique IDs', () => {
      const doc1 = service.createDocument('a.md', '');
      const doc2 = service.createDocument('b.md', '');
      expect(doc1.id).not.toBe(doc2.id);
    });
  });

  describe('addDocument', () => {
    it('adds a document to the list', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      expect(service.getAll()).toHaveLength(1);
      expect(service.getById(doc.id)).toEqual(doc);
    });
  });

  describe('setActiveId', () => {
    it('sets active document when document exists', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      service.setActiveId(doc.id);
      expect(service.getActiveId()).toBe(doc.id);
      expect(service.getActive()).toEqual(doc);
    });

    it('ignores setting active to nonexistent document', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      service.setActiveId(doc.id);
      service.setActiveId('nonexistent-id');
      expect(service.getActiveId()).toBe(doc.id); // unchanged
    });

    it('allows setting active to null', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      service.setActiveId(doc.id);
      service.setActiveId(null);
      expect(service.getActiveId()).toBeNull();
    });
  });

  describe('updateContent', () => {
    it('updates document content', () => {
      const doc = service.createDocument('test.md', 'old content');
      service.addDocument(doc);
      const result = service.updateContent(doc.id, 'new content');
      expect(result).toBe(true);
      expect(service.getById(doc.id)?.content).toBe('new content');
    });

    it('returns false for nonexistent document', () => {
      const result = service.updateContent('nonexistent', 'content');
      expect(result).toBe(false);
    });
  });

  describe('updatePageCount', () => {
    it('updates page count', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      const result = service.updatePageCount(doc.id, 5);
      expect(result).toBe(true);
      expect(service.getById(doc.id)?.pageCount).toBe(5);
    });

    it('returns false for nonexistent document', () => {
      const result = service.updatePageCount('nonexistent', 5);
      expect(result).toBe(false);
    });
  });

  describe('removeDocument', () => {
    it('removes a document', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      const result = service.removeDocument(doc.id);
      expect(result.closed).toEqual(doc);
      expect(service.isEmpty()).toBe(true);
    });

    it('returns next active when removing active document', () => {
      const doc1 = service.createDocument('a.md', 'a');
      const doc2 = service.createDocument('b.md', 'b');
      service.addDocument(doc1);
      service.addDocument(doc2);
      service.setActiveId(doc1.id);

      const result = service.removeDocument(doc1.id);
      expect(result.closed?.id).toBe(doc1.id);
      expect(result.nextActiveId).toBe(doc2.id);
    });

    it('handles removing last document', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      service.setActiveId(doc.id);

      const result = service.removeDocument(doc.id);
      expect(result.isEmpty).toBe(true);
      expect(result.nextActiveId).toBeNull();
    });
  });

  describe('renameDocument', () => {
    it('renames a document', () => {
      const doc = service.createDocument('old.md', 'content');
      service.addDocument(doc);
      const result = service.renameDocument(doc.id, 'new.md');
      expect(result.success).toBe(true);
      expect(result.newName).toBe('new.md');
      expect(service.getById(doc.id)?.filename).toBe('new.md');
    });

    it('adds .md extension if missing', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      const result = service.renameDocument(doc.id, 'newname');
      expect(result.newName).toBe('newname.md');
    });

    it('fails on empty filename', () => {
      const doc = service.createDocument('test.md', 'content');
      service.addDocument(doc);
      const result = service.renameDocument(doc.id, '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Filename cannot be empty');
    });

    it('fails on nonexistent document', () => {
      const result = service.renameDocument('nonexistent', 'name.md');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Document not found');
    });
  });

  describe('addUploadedFiles', () => {
    it('adds multiple uploaded files', () => {
      const result = service.addUploadedFiles([
        { filename: 'a.md', content: 'content a' },
        { filename: 'b.md', content: 'content b' },
      ]);
      expect(result.addedDocuments).toHaveLength(2);
      expect(result.firstDocumentId).toBe(result.addedDocuments[0].id);
      expect(service.getCount()).toBe(2);
    });

    it('handles empty array', () => {
      const result = service.addUploadedFiles([]);
      expect(result.addedDocuments).toHaveLength(0);
      expect(result.firstDocumentId).toBeNull();
    });

    it('makes filenames unique', () => {
      const doc = service.createDocument('test.md', 'existing');
      service.addDocument(doc);

      const result = service.addUploadedFiles([{ filename: 'test.md', content: 'new' }]);
      expect(result.addedDocuments[0].filename).not.toBe('test.md');
      expect(result.addedDocuments[0].filename).toContain('test');
    });
  });

  describe('ensureMarkdownFilename', () => {
    it('adds .md extension', () => {
      const name = service.ensureMarkdownFilename('file');
      expect(name).toBe('file.md');
    });

    it('keeps existing .md extension', () => {
      const name = service.ensureMarkdownFilename('file.md');
      expect(name).toBe('file.md');
    });

    it('preserves .markdown extension', () => {
      const name = service.ensureMarkdownFilename('file.markdown');
      expect(name).toBe('file.markdown');
    });
  });

  describe('toPdfFilename', () => {
    it('converts .md to .pdf', () => {
      const name = service.toPdfFilename('document.md');
      expect(name).toBe('document.pdf');
    });

    it('handles files without .md extension', () => {
      const name = service.toPdfFilename('document');
      expect(name).toBe('document.pdf');
    });
  });
});

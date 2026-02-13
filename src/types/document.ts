/**
 * Document-related type definitions.
 */

export interface ManagedDocument {
  id: string;
  filename: string;
  content: string;
  pageCount: number;
}

export interface DocumentListItem {
  id: string;
  filename: string;
  pageCount: number;
  isActive: boolean;
}

export interface UploadedMarkdownFile {
  filename: string;
  content: string;
}

export interface SavePayload {
  content: string;
  filename: string;
}

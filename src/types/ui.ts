/**
 * UI-related type definitions.
 */

import type { UploadedMarkdownFile } from './document.js';

export type ZoomMode = 'fit-width' | 'fit-page' | 'manual';
export type ThemeMode = 'dark' | 'light';
export type ExportScope = 'current' | 'all';

/**
 * Event payloads for UIController EventEmitter.
 * Keys are event names, values are the payload types.
 */
export type UIEvents = {
  /** Files have been uploaded */
  'file:upload': { files: UploadedMarkdownFile[] };
  /** A document was selected in the sidebar */
  'document:select': { documentId: string };
  /** A document was renamed */
  'document:rename': { documentId: string; nextFilename: string };
  /** A document was closed */
  'document:close': { documentId: string };
  /** A line in the canvas preview was clicked */
  'preview:line-select': { lineNumber: number };
  /** Settings (font, margin, page size, emoji mode) changed */
  'settings:change': void;
};

export interface ExportModalContext {
  activeFilename: string;
  totalFiles: number;
  isApiAvailable?: boolean;
}

export interface ExportProgressUpdate {
  processed: number;
  total: number;
  message: string;
  totalElapsedMs?: number;
  currentFileElapsedMs?: number;
}

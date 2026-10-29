export function normalizePageSizeKey(value: string): string;
export function createPdfExportSession(options: { build?: boolean; host?: string; port?: number; appUrl?: string | null }): Promise<{
  exportMarkdownToPdf(args: { markdownText: string; sourceFilename?: string; latexProject?: unknown; outputPath?: string; pageSizeKey?: string; fontSizePx?: number | null; marginMm?: number | null; mathMode?: 'html' | 'svg' }): Promise<{
    outputPath: string | null; pageSizeKey: string; pageSize: { widthMm: number; heightMm: number }; pdfBuffer: Buffer;
  }>;
  close(): Promise<void>;
}>;

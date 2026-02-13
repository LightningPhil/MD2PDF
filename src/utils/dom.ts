/**
 * DOM utility functions.
 */

/**
 * Safely gets an element by ID, throwing if not found.
 */
export function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Element with id '${id}' not found`);
  }
  return el as T;
}

/**
 * Downloads data as a file.
 * Supports both Uint8Array (for PDFs) and Blob.
 */
export function downloadFile(
  data: Uint8Array | Blob,
  filename: string,
  mimeType?: string
): void {
  const blob = data instanceof Blob
    ? data
    : new Blob([new Uint8Array(data)], { type: mimeType ?? 'application/octet-stream' });
  
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Downloads a PDF file from bytes.
 */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  downloadFile(pdfBytes, filename, 'application/pdf');
}

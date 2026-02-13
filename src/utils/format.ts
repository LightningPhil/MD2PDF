/**
 * String formatting utility functions.
 */

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Ensures a filename has a .md extension.
 */
export function ensureMarkdownFilename(filename: string): string {
  if (!filename.toLowerCase().endsWith('.md')) {
    return filename + '.md';
  }
  return filename;
}

/**
 * Converts a .md filename to .pdf.
 */
export function toPdfFilename(filename: string): string {
  return filename.replace(/\.md$/i, '.pdf');
}

/**
 * Gets the file extension from a filename.
 */
export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return '.md';
  }
  return filename.slice(dotIndex);
}

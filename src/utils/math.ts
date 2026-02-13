/**
 * Math utility functions.
 */

/**
 * Clamps a value between min and max bounds.
 * Returns min for non-finite values.
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Conversion factor: millimeters to pixels at 96 DPI */
export const MM_TO_PX = 96 / 25.4;

/** Convert millimeters to pixels */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

/** Convert pixels to points (72 points per inch) */
export function pxToPt(px: number): number {
  return px * 72 / 96;
}

/** Convert points to pixels */
export function ptToPx(pt: number): number {
  return pt * 96 / 72;
}

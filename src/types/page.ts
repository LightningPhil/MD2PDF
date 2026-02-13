/**
 * Shared page-related type definitions.
 * Single source of truth for page sizes and specifications.
 */

export type PageSizeKey = 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';

export interface PageSizeSpec {
  widthMm: number;
  heightMm: number;
}

export const PAGE_SIZES: Readonly<Record<PageSizeKey, PageSizeSpec>> = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  tabloid: { widthMm: 279.4, heightMm: 431.8 },
  a3: { widthMm: 297, heightMm: 420 },
} as const;

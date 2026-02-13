/**
 * Source mapping resolution module - maps source markdown lines to rendered PDF positions.
 * 
 * This module provides bidirectional mapping between source markdown line numbers
 * and rendered page positions (page index + Y coordinate).
 */
import type { DrawOp, PageLayout } from '../typesetter-engine/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a range of source lines to a rendered position on a page.
 */
export interface SourceMappingEntry {
  /** 1-based start line in source markdown */
  sourceLineStart: number;
  /** 1-based end line in source markdown (inclusive) */
  sourceLineEnd: number;
  /** 0-based page index */
  pageIndex: number;
  /** Y position (top) in points from page top */
  yStartPt: number;
  /** Y position (bottom) in points from page top */
  yEndPt: number;
}

interface SourceSpanLike {
  start: number;
  end: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_MAPPING_HEIGHT_PT = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Primary exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and normalizes source mapping data from an unknown source.
 * Returns null if the input is invalid or empty.
 */
export function normalizeSourceMapping(candidate: unknown): SourceMappingEntry[] | null {
  if (!Array.isArray(candidate)) {
    return null;
  }

  const normalized: SourceMappingEntry[] = [];
  for (const rawEntry of candidate) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as Partial<SourceMappingEntry>;
    const sourceLineStart = Number(entry.sourceLineStart);
    const sourceLineEnd = Number(entry.sourceLineEnd);
    const pageIndex = Number(entry.pageIndex);
    const yStartPt = Number(entry.yStartPt);
    const yEndPt = Number(entry.yEndPt);

    if (
      !Number.isFinite(sourceLineStart) ||
      !Number.isFinite(sourceLineEnd) ||
      !Number.isFinite(pageIndex) ||
      !Number.isFinite(yStartPt) ||
      !Number.isFinite(yEndPt)
    ) {
      continue;
    }

    normalized.push({
      sourceLineStart: Math.max(1, Math.floor(sourceLineStart)),
      sourceLineEnd: Math.max(Math.floor(sourceLineStart), Math.floor(sourceLineEnd)),
      pageIndex: Math.max(0, Math.floor(pageIndex)),
      yStartPt: Math.min(yStartPt, yEndPt),
      yEndPt: Math.max(yStartPt, yEndPt),
    });
  }

  if (normalized.length === 0) {
    return null;
  }

  normalized.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.yStartPt !== b.yStartPt) {
      return a.yStartPt - b.yStartPt;
    }
    return a.sourceLineStart - b.sourceLineStart;
  });

  return normalized;
}

/**
 * Derives source mapping from sourceSpan annotations on draw operations.
 * This is the primary strategy when the typesetter provides source spans.
 */
export function deriveSourceMappingFromSourceSpans(markdown: string, pages: PageLayout[]): SourceMappingEntry[] | null {
  if (!markdown || pages.length === 0) {
    return null;
  }

  const normalizedSource = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lineStarts = getSourceLineStarts(normalizedSource);
  const extracted: SourceMappingEntry[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    collectSourceSpanMappingsFromOps(
      pages[pageIndex].ops,
      pageIndex,
      lineStarts,
      extracted,
    );
  }

  if (extracted.length === 0) {
    return null;
  }

  extracted.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) {
      return a.pageIndex - b.pageIndex;
    }
    if (a.sourceLineStart !== b.sourceLineStart) {
      return a.sourceLineStart - b.sourceLineStart;
    }
    return a.yStartPt - b.yStartPt;
  });

  // Merge adjacent entries for the same source line range
  const merged: SourceMappingEntry[] = [];
  for (const entry of extracted) {
    const previous = merged.length > 0 ? merged[merged.length - 1] : null;
    if (
      previous &&
      previous.pageIndex === entry.pageIndex &&
      previous.sourceLineStart === entry.sourceLineStart &&
      previous.sourceLineEnd === entry.sourceLineEnd &&
      entry.yStartPt <= previous.yEndPt + 1.5
    ) {
      previous.yStartPt = Math.min(previous.yStartPt, entry.yStartPt);
      previous.yEndPt = Math.max(previous.yEndPt, entry.yEndPt);
      continue;
    }
    merged.push({ ...entry });
  }

  return merged.length > 0 ? merged : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively collects source mapping entries from draw operations.
 */
function collectSourceSpanMappingsFromOps(
  ops: ReadonlyArray<DrawOp>,
  pageIndex: number,
  lineStarts: readonly number[],
  output: SourceMappingEntry[],
): void {
  for (const op of ops) {
    const sourceSpan = getSourceSpan(op);
    const yRange = getOpYRangePt(op);
    if (sourceSpan && yRange) {
      const sourceLineStart = offsetToLineNumber(sourceSpan.start, lineStarts);
      const sourceLineEnd = offsetToLineNumber(Math.max(sourceSpan.start, sourceSpan.end - 1), lineStarts);
      output.push({
        sourceLineStart,
        sourceLineEnd,
        pageIndex,
        yStartPt: yRange.yStartPt,
        yEndPt: Math.max(yRange.yEndPt, yRange.yStartPt + MIN_MAPPING_HEIGHT_PT),
      });
    }

    if (op.kind === 'textSpan') {
      collectSourceSpanMappingsFromOps(op.ops, pageIndex, lineStarts, output);
    }
  }
}

/**
 * Extracts sourceSpan from a draw operation if present.
 */
function getSourceSpan(op: DrawOp): SourceSpanLike | null {
  if (!('sourceSpan' in op)) {
    return null;
  }

  const raw = (op as { sourceSpan?: unknown }).sourceSpan;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const start = Number((raw as { start?: unknown }).start);
  const end = Number((raw as { end?: unknown }).end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const normalizedStart = Math.max(0, Math.floor(start));
  const normalizedEnd = Math.max(normalizedStart, Math.floor(end));
  return { start: normalizedStart, end: normalizedEnd };
}

/**
 * Calculates the Y range (top to bottom) of a draw operation in points.
 */
function getOpYRangePt(op: DrawOp): { yStartPt: number; yEndPt: number } | null {
  switch (op.kind) {
    case 'glyph':
    case 'glyphRun': {
      const ascentPt = op.fontSizePt * 0.85;
      const descentPt = op.fontSizePt * 0.35;
      return {
        yStartPt: op.yBaselinePt - ascentPt,
        yEndPt: op.yBaselinePt + descentPt,
      };
    }
    case 'textSpan': {
      let yStartPt = Number.POSITIVE_INFINITY;
      let yEndPt = Number.NEGATIVE_INFINITY;
      for (const child of op.ops) {
        const childRange = getOpYRangePt(child);
        if (!childRange) {
          continue;
        }
        yStartPt = Math.min(yStartPt, childRange.yStartPt);
        yEndPt = Math.max(yEndPt, childRange.yEndPt);
      }
      if (!Number.isFinite(yStartPt) || !Number.isFinite(yEndPt)) {
        return null;
      }
      return { yStartPt, yEndPt };
    }
    case 'link':
      return {
        yStartPt: op.yPt,
        yEndPt: op.yPt + op.hPt,
      };
    case 'underline':
    case 'strikethrough':
      return {
        yStartPt: op.yPt - op.thicknessPt / 2,
        yEndPt: op.yPt + op.thicknessPt / 2,
      };
    default:
      return null;
  }
}

/**
 * Builds an array of character offsets where each line starts in the source.
 */
function getSourceLineStarts(source: string): number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '\r') {
      if (source[i + 1] === '\n') {
        lineStarts.push(i + 2);
        i += 1;
      } else {
        lineStarts.push(i + 1);
      }
      continue;
    }
    if (char === '\n') {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * Converts a character offset to a 1-based line number using binary search.
 */
function offsetToLineNumber(offset: number, lineStarts: readonly number[]): number {
  if (lineStarts.length === 0) {
    return 1;
  }

  let low = 0;
  let high = lineStarts.length - 1;
  let best = 0;
  const targetOffset = Math.max(0, Math.floor(offset));

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midOffset = lineStarts[mid];
    if (midOffset <= targetOffset) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best + 1;
}

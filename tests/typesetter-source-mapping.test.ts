import { beforeEach, describe, expect, it, vi } from 'vitest';

const typesetMock = vi.fn();

vi.mock('../src/typesetter-engine/index.js', () => ({
  createTypesetter: vi.fn(() => ({
    typeset: typesetMock,
    renderToCanvas: vi.fn(),
    renderToPdf: vi.fn(),
  })),
  loadFontSpecFromUrl: vi.fn(async (id: string, _url: string, cssFamily?: string) => ({
    id,
    source: new ArrayBuffer(0),
    cssFamily,
  })),
  mmToPt: (mm: number) => mm * 72 / 25.4,
}));

const baseConfig = {
  pageSize: 'a4',
  marginMm: 20,
  fontSizePt: 12,
} as const;

function createPageWithOps(ops: unknown[]) {
  return {
    index: 0,
    widthPt: 595,
    heightPt: 842,
    ops,
  };
}

describe('typesetter source-mapping compatibility', () => {
  beforeEach(() => {
    typesetMock.mockReset();
    vi.resetModules();
  });

  it('uses package-provided source mapping when available', async () => {
    const providedMapping = [{
      sourceLineStart: 2,
      sourceLineEnd: 4,
      pageIndex: 0,
      yStartPt: 120,
      yEndPt: 180,
    }];

    typesetMock.mockResolvedValueOnce({
      pages: [createPageWithOps([])],
      diagnostics: { warnings: [], errors: [] },
      sourceMapping: providedMapping,
    });

    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown('line1\nline2\nline3', baseConfig);

    expect(result.sourceMapping).toEqual(providedMapping);
  });

  it('derives source mapping from op source spans when top-level mapping is absent', async () => {
    typesetMock.mockResolvedValueOnce({
      pages: [createPageWithOps([
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 100,
          text: 'Hello',
          xOffsetsPt: [0],
          sourceSpan: { start: 0, end: 5, kind: 'markdown' },
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 140,
          text: 'World',
          xOffsetsPt: [0],
          sourceSpan: { start: 6, end: 11, kind: 'markdown' },
        },
      ])],
      diagnostics: { warnings: [], errors: [] },
    });

    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown('Hello\nWorld', baseConfig);

    const mappedLines = (result.sourceMapping ?? []).map((entry) => entry.sourceLineStart);
    expect(mappedLines).toContain(1);
    expect(mappedLines).toContain(2);
  });

  it('returns null when no source mapping or source spans exist', async () => {
    // In the new architecture, we don't use heuristic rendered-line matching.
    // If the typesetter doesn't provide sourceMapping and ops have no sourceSpan,
    // the result should be null (no mapping).
    typesetMock.mockResolvedValueOnce({
      pages: [createPageWithOps([
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 100,
          text: 'Line A',
          xOffsetsPt: [0],
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 180,
          text: 'Line B',
          xOffsetsPt: [0],
        },
      ])],
      diagnostics: { warnings: [], errors: [] },
    });

    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown('one\ntwo\nthree\nfour', baseConfig);

    // No sourceMapping since ops have no sourceSpan and typesetter didn't provide mapping
    expect(result.sourceMapping).toBeFalsy();
  });

  it('keeps mapping stable when source includes blank/meta lines', async () => {
    // Test that the typesetter directly provides a complete sourceMapping
    // for content that includes blank and meta lines (e.g., headings, horizontal rules).
    const providedMapping = [
      { sourceLineStart: 1, sourceLineEnd: 1, pageIndex: 0, yStartPt: 70, yEndPt: 100 }, // # Title
      { sourceLineStart: 2, sourceLineEnd: 2, pageIndex: 0, yStartPt: 100, yEndPt: 110 }, // blank
      { sourceLineStart: 3, sourceLineEnd: 3, pageIndex: 0, yStartPt: 110, yEndPt: 120 }, // ---
      { sourceLineStart: 4, sourceLineEnd: 4, pageIndex: 0, yStartPt: 120, yEndPt: 130 }, // blank  
      { sourceLineStart: 5, sourceLineEnd: 5, pageIndex: 0, yStartPt: 140, yEndPt: 180 }, // Body text
    ];

    typesetMock.mockResolvedValueOnce({
      pages: [createPageWithOps([
        {
          kind: 'textSpan',
          id: 'span-1',
          role: 'heading',
          ops: [{
            kind: 'glyphRun',
            fontId: 'text',
            fontSizePt: 12,
            xPt: 40,
            yBaselinePt: 90,
            text: 'Title',
            xOffsetsPt: [0],
          }],
        },
        {
          kind: 'textSpan',
          id: 'span-2',
          role: 'paragraph',
          ops: [{
            kind: 'glyphRun',
            fontId: 'text',
            fontSizePt: 12,
            xPt: 40,
            yBaselinePt: 170,
            text: 'Body text',
            xOffsetsPt: [0],
          }],
        },
      ])],
      diagnostics: { warnings: [], errors: [] },
      sourceMapping: providedMapping,
    });

    const markdown = '# Title\n\n---\n\nBody text';
    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown(markdown, baseConfig);

    expect(result.sourceMapping).toHaveLength(5);
    expect(result.sourceMapping?.[0].yStartPt ?? 0).toBeLessThan(result.sourceMapping?.[4].yStartPt ?? 0);
  });

  it('derives partial mapping from partial source-span data', async () => {
    // When the typesetter doesn't provide top-level sourceMapping but ops have partial sourceSpan,
    // we derive mapping only for the lines with sourceSpan (we no longer "fill gaps" with heuristics).
    typesetMock.mockResolvedValueOnce({
      pages: [createPageWithOps([
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 100,
          text: 'Line one',
          xOffsetsPt: [0],
          sourceSpan: { start: 0, end: 8, kind: 'markdown' }, // Line 1
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 140,
          text: 'Line two',
          xOffsetsPt: [0],
          // No sourceSpan
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 180,
          text: 'Line three',
          xOffsetsPt: [0],
          // No sourceSpan
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 220,
          text: 'Line four',
          xOffsetsPt: [0],
          // No sourceSpan
        },
      ])],
      diagnostics: { warnings: [], errors: [] },
    });

    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown('Line one\nLine two\nLine three\nLine four', baseConfig);

    // Only line 1 has sourceSpan, so only 1 mapping entry is derived
    expect(result.sourceMapping).toHaveLength(1);
    expect(result.sourceMapping?.[0].sourceLineStart).toBe(1);
  });
});

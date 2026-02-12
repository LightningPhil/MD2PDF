import { beforeEach, describe, expect, it, vi } from 'vitest';

const typesetMock = vi.fn();

vi.mock('canvadoc-typesetter', () => ({
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

  it('falls back to rendered-line mapping when no source span data exists', async () => {
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

    expect(result.sourceMapping).toHaveLength(4);
    expect(result.sourceMapping?.every((entry) => entry.pageIndex === 0)).toBe(true);
    const first = result.sourceMapping?.[0];
    const last = result.sourceMapping?.[result.sourceMapping.length - 1];
    expect(first && last ? first.yStartPt < last.yStartPt : false).toBe(true);
  });

  it('keeps mapping stable when source includes blank/meta lines', async () => {
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
    });

    const markdown = '# Title\n\n---\n\nBody text';
    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown(markdown, baseConfig);

    expect(result.sourceMapping).toHaveLength(5);
    expect(result.sourceMapping?.[0].yStartPt ?? 0).toBeLessThan(result.sourceMapping?.[4].yStartPt ?? 0);
  });

  it('fills coverage gaps when source-span mapping is partial', async () => {
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
          sourceSpan: { start: 0, end: 8, kind: 'markdown' },
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 140,
          text: 'Line two',
          xOffsetsPt: [0],
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 180,
          text: 'Line three',
          xOffsetsPt: [0],
        },
        {
          kind: 'glyphRun',
          fontId: 'text',
          fontSizePt: 12,
          xPt: 40,
          yBaselinePt: 220,
          text: 'Line four',
          xOffsetsPt: [0],
        },
      ])],
      diagnostics: { warnings: [], errors: [] },
    });

    const { typesetMarkdown } = await import('../src/typesetter');
    const result = await typesetMarkdown('Line one\nLine two\nLine three\nLine four', baseConfig);

    expect(result.sourceMapping).toHaveLength(4);
    const mappedLines = (result.sourceMapping ?? []).map((entry) => entry.sourceLineStart);
    expect(mappedLines).toEqual([1, 2, 3, 4]);
  });
});

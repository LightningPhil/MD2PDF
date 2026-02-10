/**
 * Source line range for a parsed block.
 * Line numbers are 1-based.
 */
export type SourceLineRange = {
  /** First source line (1-based) */
  start: number;
  /** Last source line (1-based, inclusive) */
  end: number;
};

/**
 * Parsed markdown block types.
 *
 * The typesetter recognizes these block types:
 * - `heading`: H1-H3 headers
 * - `paragraph`: Regular text paragraphs
 * - `list`: Ordered or unordered lists (supports nested depth metadata)
 * - `code`: Fenced code blocks
 * - `displayMath`: Display math blocks ($$...$$)
 * - `blockquote`: Quote blocks with depth
 * - `table`: Pipe tables with alignment
 * - `hr`: Horizontal rules
 */
export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; sourceLines: SourceLineRange }
  | { kind: "paragraph"; text: string; sourceLines: SourceLineRange }
  | {
      kind: "list";
      ordered: boolean;
      items: string[];
      itemDepths?: number[];
      itemKinds?: Array<"ordered" | "unordered">;
      itemNumbers?: Array<number | null>;
      sourceLines: SourceLineRange;
    }
  | { kind: "blockquote"; depth: number; text: string; sourceLines: SourceLineRange }
  | { kind: "code"; lines: string[]; sourceLines: SourceLineRange }
  | { kind: "displayMath"; expr: string; sourceLines: SourceLineRange }
  | { kind: "table"; header: string[]; align: TableAlign[]; rows: string[][]; sourceLines: SourceLineRange }
  | { kind: "hr"; sourceLines: SourceLineRange };

/**
 * Table column alignment.
 * Determined by alignment markers in the separator row:
 * - `:---` = left
 * - `:---:` = center
 * - `---:` = right
 */
export type TableAlign = "left" | "right" | "center";

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const ORDERED_RE = /^(\d+)\.\s+(.+)$/;
const UNORDERED_RE = /^-\s+(.+)$/;
const LIST_ITEM_RE = /^(\s*)([-+*]|\d+\.)\s+(.+)$/;
const BLOCKQUOTE_RE = /^(\s*(?:>\s*)+)(.*)$/;

/**
 * Parse markdown text into an array of block elements.
 *
 * Supported syntax:
 * - `# `, `## `, `### ` for headings (H1-H3)
 * - Regular text paragraphs (separated by blank lines)
 * - `- ` for unordered lists
 * - `1. ` for ordered lists
 * - Triple backticks for code blocks
 * - `$$...$$` for display math
 * - Pipe tables with alignment markers
 * - `---` for horizontal rules
 *
 * @param markdown - Raw markdown text to parse
 * @returns Array of parsed block elements
 *
 * @example
 * ```typescript
 * const blocks = parseMarkdownBlocks(`
 * # Title
 *
 * This is a paragraph.
 *
 * - Item 1
 * - Item 2
 * `);
 * // Returns: [{ kind: "heading", level: 1, text: "Title" }, ...]
 * ```
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    const blockStartLine = i + 1; // 1-based line number

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) {
        i += 1;
      }
      blocks.push({ kind: "code", lines: codeLines, sourceLines: { start: blockStartLine, end: i } });
      continue;
    }

    if (line.startsWith("$$")) {
      const inlineExpr = extractSingleLineDisplayMath(line);
      if (inlineExpr !== null) {
        blocks.push({ kind: "displayMath", expr: inlineExpr, sourceLines: { start: blockStartLine, end: blockStartLine } });
        i += 1;
        continue;
      }

      const mathLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().endsWith("$$")) {
        mathLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) {
        const last = (lines[i] ?? "").trim();
        mathLines.push(last.slice(0, Math.max(0, last.length - 2)).trim());
        i += 1;
      }
      blocks.push({ kind: "displayMath", expr: mathLines.join(" ").trim(), sourceLines: { start: blockStartLine, end: i } });
      continue;
    }

    if (i + 1 < lines.length && looksLikeTable(lines[i] ?? "", lines[i + 1] ?? "")) {
      const rawHeader = parseTableRow(lines[i] ?? "");
      const rawAlign = parseTableRow(lines[i + 1] ?? "");
      const columnCount = Math.max(rawHeader.length, rawAlign.length);
      const header = normalizeTableCells(rawHeader, columnCount);
      const align = parseTableAlignments(rawAlign, columnCount);

      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const candidate = lines[i] ?? "";
        const trimmed = candidate.trim();
        if (!trimmed) {
          break;
        }
        if (!candidate.includes("|") || isBlockStart(candidate)) {
          break;
        }
        rows.push(normalizeTableCells(parseTableRow(candidate), columnCount));
        i += 1;
      }

      blocks.push({ kind: "table", header, align, rows, sourceLines: { start: blockStartLine, end: i } });
      continue;
    }

    const headingMatch = raw.match(HEADING_RE);
    if (headingMatch) {
      const hashCount = headingMatch[1].length;
      blocks.push({
        kind: "heading",
        level: hashCount as 1 | 2 | 3,
        text: headingMatch[2].trim(),
        sourceLines: { start: blockStartLine, end: blockStartLine }
      });
      i += 1;
      continue;
    }

    if (line === "---") {
      blocks.push({ kind: "hr", sourceLines: { start: blockStartLine, end: blockStartLine } });
      i += 1;
      continue;
    }

    const quoteMatch = raw.match(BLOCKQUOTE_RE);
    if (quoteMatch) {
      const quoteLines: Array<{ depth: number; text: string }> = [];
      const quoteStartLine = blockStartLine;
      while (i < lines.length) {
        const lineMatch = (lines[i] ?? "").match(BLOCKQUOTE_RE);
        if (!lineMatch) {
          break;
        }
        const depth = Math.max(1, Math.min(2, (lineMatch[1].match(/>/g) ?? []).length));
        quoteLines.push({ depth, text: lineMatch[2] ?? "" });
        i += 1;
      }
      const quoteEndLine = i;

      let segmentDepth = quoteLines[0]?.depth ?? 1;
      let segment: string[] = [];
      for (const quoteLine of quoteLines) {
        if (quoteLine.depth !== segmentDepth && segment.length > 0) {
          blocks.push({
            kind: "blockquote",
            depth: segmentDepth,
            text: combineParagraphLines(segment),
            sourceLines: { start: quoteStartLine, end: quoteEndLine }
          });
          segment = [];
          segmentDepth = quoteLine.depth;
        }
        segment.push(quoteLine.text);
      }
      if (segment.length > 0) {
        blocks.push({
          kind: "blockquote",
          depth: segmentDepth,
          text: combineParagraphLines(segment),
          sourceLines: { start: quoteStartLine, end: quoteEndLine }
        });
      }
      continue;
    }

    const listMatch = raw.match(LIST_ITEM_RE);
    if (listMatch) {
      const items: string[] = [];
      const itemDepths: number[] = [];
      const itemKinds: Array<"ordered" | "unordered"> = [];
      const itemNumbers: Array<number | null> = [];
      let firstOrdered = /^\d+\.$/.test(listMatch[2]);
      while (i < lines.length) {
        const next = (lines[i] ?? "").match(LIST_ITEM_RE);
        if (!next) {
          break;
        }
        const indent = next[1] ?? "";
        const depth = Math.min(1, Math.floor(indent.length / 2));
        const marker = next[2];
        const isOrdered = /^\d+\.$/.test(marker);
        items.push((next[3] ?? "").trimEnd());
        itemDepths.push(depth);
        itemKinds.push(isOrdered ? "ordered" : "unordered");
        itemNumbers.push(isOrdered ? parseInt(marker.slice(0, -1), 10) : null);
        i += 1;
      }
      const hasNested = itemDepths.some((depth) => depth > 0);
      const hasMixedKinds = itemKinds.some(
        (kind) => kind !== (firstOrdered ? "ordered" : "unordered")
      );
      const listBlock: Extract<MarkdownBlock, { kind: "list" }> = {
        kind: "list",
        ordered: firstOrdered,
        items,
        sourceLines: { start: blockStartLine, end: i }
      };
      if (hasNested || hasMixedKinds) {
        listBlock.itemDepths = itemDepths;
        listBlock.itemKinds = itemKinds;
        listBlock.itemNumbers = itemNumbers;
      }
      blocks.push(listBlock);
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && !isBlockStart(lines[i] ?? "")) {
      const nextRaw = lines[i] ?? "";
      if (!nextRaw.trim()) {
        break;
      }
      paragraphLines.push(nextRaw);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: combineParagraphLines(paragraphLines), sourceLines: { start: blockStartLine, end: i } });

    while (i < lines.length && !(lines[i] ?? "").trim()) {
      i += 1;
    }
  }

  return blocks;
}

function extractSingleLineDisplayMath(line: string): string | null {
  if (!line.startsWith("$$") || !line.endsWith("$$") || line.length < 4) {
    return null;
  }
  return line.slice(2, -2).trim();
}

function isBlockStart(rawLine: string): boolean {
  const line = rawLine.trim();
  if (!line) {
    return true;
  }
  return (
    line.startsWith("```") ||
    line.startsWith("$$") ||
    line === "---" ||
    (rawLine.includes("|") && isTableSeparatorLine(rawLine)) ||
    BLOCKQUOTE_RE.test(rawLine) ||
    HEADING_RE.test(rawLine) ||
    LIST_ITEM_RE.test(rawLine)
  );
}

function looksLikeTable(headerLine: string, separatorLine: string): boolean {
  if (!headerLine.includes("|")) {
    return false;
  }
  if (HEADING_RE.test(headerLine) || LIST_ITEM_RE.test(headerLine) || BLOCKQUOTE_RE.test(headerLine)) {
    return false;
  }
  return isTableSeparatorLine(separatorLine);
}

function isTableSeparatorLine(rawLine: string): boolean {
  const cells = parseTableRow(rawLine);
  if (cells.length === 0) {
    return false;
  }
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTableAlignments(cells: string[], columnCount: number): TableAlign[] {
  const align: TableAlign[] = [];
  for (let i = 0; i < columnCount; i += 1) {
    const raw = (cells[i] ?? "").trim();
    const left = raw.startsWith(":");
    const right = raw.endsWith(":");
    if (left && right) {
      align.push("center");
      continue;
    }
    if (right) {
      align.push("right");
      continue;
    }
    align.push("left");
  }
  return align;
}

function normalizeTableCells(cells: string[], columnCount: number): string[] {
  const normalized = cells.slice(0, columnCount);
  while (normalized.length < columnCount) {
    normalized.push("");
  }
  return normalized;
}

function parseTableRow(rawLine: string): string[] {
  let line = rawLine.trim();
  if (line.startsWith("|")) {
    line = line.slice(1);
  }
  if (line.endsWith("|")) {
    line = line.slice(0, -1);
  }

  const cells: string[] = [];
  let buffer = "";
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) {
      buffer += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "|") {
      cells.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  cells.push(buffer.trim());
  return cells;
}

function combineParagraphLines(lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }

  let out = "";
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const hardBreak = / {2,}$/.test(raw);
    const trimmed = raw.trim();
    out += trimmed;
    if (i < lines.length - 1) {
      out += hardBreak ? "\n" : " ";
    }
  }
  return out.trim();
}

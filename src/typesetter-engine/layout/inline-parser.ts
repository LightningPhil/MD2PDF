/**
 * Deterministic inline markdown parser used by the layout engine.
 *
 * Purpose:
 * - Parse inline text into semantically typed nodes (text, code, math, links, breaks).
 * - Preserve simple style metadata (bold/italic/strike/href) for downstream layout.
 *
 * Usage:
 * - `layout/engine.ts` calls `parseInlineNodes` for paragraphs, list items, and table cells.
 */
export type InlineTextStyle = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  href?: string;
};

export type InlineNode =
  | { kind: "text"; text: string; style?: InlineTextStyle }
  | { kind: "math"; expr: string; style?: InlineTextStyle }
  | { kind: "code"; code: string; style?: InlineTextStyle }
  | { kind: "lineBreak" };

export function parseInlineNodes(input: string): InlineNode[] {
  const nodes = parseSegment(input, {});
  return mergeAdjacentText(nodes);
}

function parseSegment(input: string, style: InlineTextStyle): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let i = 0;

  const flushBuffer = (): void => {
    if (!buffer) {
      return;
    }
    nodes.push({ kind: "text", text: buffer, style: cloneStyle(style) });
    buffer = "";
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === "\n") {
      // Preserve explicit hard breaks so line splitting can honor author intent.
      flushBuffer();
      nodes.push({ kind: "lineBreak" });
      i += 1;
      continue;
    }

    if (ch === "`") {
      const end = input.indexOf("`", i + 1);
      if (end > i + 1) {
        flushBuffer();
        nodes.push({
          kind: "code",
          code: input.slice(i + 1, end),
          style: cloneStyle(style)
        });
        i = end + 1;
        continue;
      }
    }

    if (ch === "$" && input[i + 1] !== "$") {
      const end = findClosingMathDollar(input, i + 1);
      if (end > i + 1) {
        flushBuffer();
        nodes.push({
          kind: "math",
          expr: input.slice(i + 1, end),
          style: cloneStyle(style)
        });
        i = end + 1;
        continue;
      }
    }

    const link = parseLinkAt(input, i);
    if (link) {
      flushBuffer();
      // Parse link labels recursively so nested emphasis inside labels is retained.
      const linkStyle = withStyle(style, { href: link.href });
      nodes.push(...parseSegment(link.label, linkStyle));
      i = link.end;
      continue;
    }

    const autolink = parseAutolinkAt(input, i);
    if (autolink) {
      flushBuffer();
      const linkStyle = withStyle(style, { href: autolink.href });
      nodes.push({ kind: "text", text: autolink.label, style: linkStyle });
      i = autolink.end;
      continue;
    }

    if (input.startsWith("~~", i)) {
      const end = findClosingToken(input, "~~", i + 2);
      if (end > i + 1) {
        flushBuffer();
        const inner = input.slice(i + 2, end);
        nodes.push(...parseSegment(inner, withStyle(style, { strike: true })));
        i = end + 2;
        continue;
      }
    }

    if (input.startsWith("**", i) || input.startsWith("__", i)) {
      const marker = input.slice(i, i + 2);
      const end = findClosingToken(input, marker, i + 2);
      if (end > i + 1) {
        flushBuffer();
        const inner = input.slice(i + 2, end);
        nodes.push(...parseSegment(inner, withStyle(style, { bold: true })));
        i = end + 2;
        continue;
      }
    }

    if (ch === "*" || ch === "_") {
      const end = findClosingToken(input, ch, i + 1);
      if (end > i) {
        flushBuffer();
        const inner = input.slice(i + 1, end);
        nodes.push(...parseSegment(inner, withStyle(style, { italic: true })));
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flushBuffer();
  return nodes;
}

function parseLinkAt(
  text: string,
  start: number
): { label: string; href: string; end: number } | null {
  if (text[start] !== "[") {
    return null;
  }
  const labelEnd = findMatchingBracket(text, start + 1, "[", "]");
  if (labelEnd < 0 || text[labelEnd + 1] !== "(") {
    return null;
  }
  const hrefEnd = findMatchingBracket(text, labelEnd + 2, "(", ")");
  if (hrefEnd < 0) {
    return null;
  }

  const label = text.slice(start + 1, labelEnd);
  const href = text.slice(labelEnd + 2, hrefEnd).trim();
  if (!href) {
    return null;
  }

  return {
    label,
    href,
    end: hrefEnd + 1
  };
}

function parseAutolinkAt(
  text: string,
  start: number
): { label: string; href: string; end: number } | null {
  if (text[start] !== "<") {
    return null;
  }
  const end = text.indexOf(">", start + 1);
  if (end < 0) {
    return null;
  }
  const content = text.slice(start + 1, end).trim();
  if (!/^https?:\/\//i.test(content)) {
    return null;
  }
  return {
    label: content,
    href: content,
    end: end + 1
  };
}

function findMatchingBracket(
  text: string,
  from: number,
  open: string,
  close: string
): number {
  let depth = 1;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      i += 1;
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function findClosingToken(text: string, token: string, from: number): number {
  for (let i = from; i <= text.length - token.length; i += 1) {
    if (text[i - 1] === "\\") {
      continue;
    }
    if (text.slice(i, i + token.length) === token) {
      return i;
    }
  }
  return -1;
}

function findClosingMathDollar(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === "$" && text[i - 1] !== "\\") {
      return i;
    }
  }
  return -1;
}

function withStyle(base: InlineTextStyle, patch: InlineTextStyle): InlineTextStyle {
  return {
    bold: patch.bold ?? base.bold,
    italic: patch.italic ?? base.italic,
    strike: patch.strike ?? base.strike,
    href: patch.href ?? base.href
  };
}

function cloneStyle(style: InlineTextStyle): InlineTextStyle | undefined {
  if (!style.bold && !style.italic && !style.strike && !style.href) {
    return undefined;
  }
  return { ...style };
}

function mergeAdjacentText(nodes: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const prev = merged[merged.length - 1];
    if (
      node.kind === "text" &&
      prev?.kind === "text" &&
      sameStyle(prev.style, node.style)
    ) {
      prev.text += node.text;
      continue;
    }
    merged.push(node);
  }
  return merged;
}

function sameStyle(a?: InlineTextStyle, b?: InlineTextStyle): boolean {
  return (
    (a?.bold ?? false) === (b?.bold ?? false) &&
    (a?.italic ?? false) === (b?.italic ?? false) &&
    (a?.strike ?? false) === (b?.strike ?? false) &&
    (a?.href ?? "") === (b?.href ?? "")
  );
}

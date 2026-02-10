/**
 * Canvas renderer for page display lists.
 *
 * Purpose:
 * - Paint precomputed `DrawOp` geometry onto an HTML canvas.
 * - Handle device pixel ratio scaling and multi-page viewport composition.
 *
 * Usage:
 * - Invoked by `typesetter.renderToCanvas(...)` from UI code (demo/editor integrations).
 * - Receives layout output directly; no geometry recalculation should happen here.
 */
import { FontMetricsProvider } from "../font-metrics";
import type { CanvasViewOptions, DrawOp, PageLayout } from "../types";

const PT_TO_CSS_PX = 96 / 72;

export function renderPagesToCanvas(
  pages: PageLayout[],
  canvas: HTMLCanvasElement,
  view: CanvasViewOptions,
  metrics: FontMetricsProvider
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  if (pages.length === 0) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.width = "1px";
    canvas.style.height = "1px";
    ctx.clearRect(0, 0, 1, 1);
    return;
  }

  const pagesToDraw =
    view.mode === "singlePage"
      ? [pages[Math.min(Math.max(view.pageIndex ?? 0, 0), pages.length - 1)]]
      : pages;

  const pageGapPt = view.mode === "singlePage" ? 0 : view.pageGapPt;
  const totalHeightPt =
    pagesToDraw.reduce((sum, page) => sum + page.heightPt, 0) +
    Math.max(0, pagesToDraw.length - 1) * pageGapPt;
  const maxWidthPt = Math.max(...pagesToDraw.map((page) => page.widthPt));
  const cssScale = PT_TO_CSS_PX * view.zoom;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const cssWidthPx = Math.ceil(maxWidthPt * cssScale);
  const cssHeightPx = Math.ceil(totalHeightPt * cssScale);
  canvas.width = Math.max(1, Math.ceil(cssWidthPx * dpr));
  canvas.height = Math.max(1, Math.ceil(cssHeightPx * dpr));
  canvas.style.width = `${cssWidthPx}px`;
  canvas.style.height = `${cssHeightPx}px`;

  // One transform sets point-space -> backing-store pixels for all draw ops.
  ctx.setTransform(dpr * cssScale, 0, 0, dpr * cssScale, 0, 0);
  ctx.clearRect(0, 0, maxWidthPt, totalHeightPt);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#c6c6c6";

  let offsetYPt = 0;
  for (const page of pagesToDraw) {
    if (view.background === "white") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, offsetYPt, page.widthPt, page.heightPt);
      ctx.strokeStyle = "#d0d0d0";
      ctx.strokeRect(0, offsetYPt, page.widthPt, page.heightPt);
      ctx.fillStyle = "#111";
    }

    for (const op of page.ops) {
      drawOp(ctx, op, offsetYPt, metrics);
    }
    offsetYPt += page.heightPt + pageGapPt;
  }
}

function drawOp(
  ctx: CanvasRenderingContext2D,
  op: DrawOp,
  pageOffsetYPt: number,
  metrics: FontMetricsProvider
): void {
  if (op.kind === "glyph") {
    const family = metrics.getCssFamily(op.fontId);
    ctx.font = `${op.fontSizePt}px "${family}"`;
    ctx.fillText(op.char, op.xPt, pageOffsetYPt + op.yBaselinePt);
    return;
  }

  if (op.kind === "glyphRun") {
    const family = metrics.getCssFamily(op.fontId);
    ctx.font = `${op.fontSizePt}px "${family}"`;
    const baseline = pageOffsetYPt + op.yBaselinePt;
    if (op.xOffsetsPt && op.xOffsetsPt.length >= op.text.length) {
      for (let i = 0; i < op.text.length; i += 1) {
        ctx.fillText(op.text[i], op.xPt + op.xOffsetsPt[i], baseline);
      }
      return;
    }
    ctx.fillText(op.text, op.xPt, baseline);
    return;
  }

  if (op.kind === "textSpan") {
    // Wrapper node for semantics/debugging; paint children in order.
    for (const child of op.ops) {
      drawOp(ctx, child, pageOffsetYPt, metrics);
    }
    return;
  }

  if (op.kind === "link") {
    return;
  }

  if (op.kind === "underline" || op.kind === "strikethrough") {
    if (op.colorRgb) {
      const [r, g, b] = op.colorRgb;
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    ctx.fillRect(op.xPt, pageOffsetYPt + op.yPt, op.wPt, op.thicknessPt);
    if (op.colorRgb) {
      ctx.fillStyle = "#111";
    }
    return;
  }

  if (op.kind === "rule") {
    if (op.colorRgb) {
      const [r, g, b] = op.colorRgb;
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    ctx.fillRect(op.xPt, pageOffsetYPt + op.yPt, op.wPt, op.hPt);
    if (op.colorRgb) {
      ctx.fillStyle = "#111";
    }
    return;
  }

  if (op.kind === "debugBox") {
    ctx.strokeStyle = "#f00";
    ctx.strokeRect(op.xPt, pageOffsetYPt + op.yPt, op.wPt, op.hPt);
    ctx.strokeStyle = "#d0d0d0";
  }
}

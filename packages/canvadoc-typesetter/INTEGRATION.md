# canvadoc-typesetter Integration Guide

## Environment Expectations

- Node: validated on `20.x` to `22.x`
- Package manager: validated on `pnpm 10.x`
- Browser integrations should provide font loading and a canvas element.

## Install

```bash
pnpm add canvadoc-typesetter
```

## Required and Optional Inputs

- Required fonts:
  - `fonts.text`
  - `fonts.math`
- Optional fonts:
  - `fonts.mono`
  - `fonts.fallback[]` (recommended for emoji/missing glyph coverage)

## Minimal Workflow

```ts
import {
  createTypesetter,
  getCanvaDocTypesetterMetadata,
  loadFontSpecFromUrl
} from "canvadoc-typesetter";

const meta = getCanvaDocTypesetterMetadata();
if (!meta.capabilities.sourceMapping) {
  // Optional app fallback behavior.
}

const text = await loadFontSpecFromUrl("text", "/fonts/LibertinusSerif-Regular.otf");
const math = await loadFontSpecFromUrl("math", "/fonts/STIXTwoMath-Regular.otf");

const typesetter = createTypesetter({
  page: { size: "A4", margin: "Medium" },
  typography: {
    baseFontSizePt: 12,
    lineHeight: 1.35,
    paragraphSpacingPt: 6,
    headingScale: { h1: 2, h2: 1.6, h3: 1.3 }
  },
  fonts: { text, math }
});

const result = await typesetter.typeset("# Hello");
typesetter.renderToCanvas(result.pages, canvas, {
  zoom: 1,
  pageGapPt: 20,
  background: "white",
  mode: "stackedPages"
});
const pdf = await typesetter.renderToPdf(result.pages, { title: "Export" });
```

## Integration Guarantees

Stable across patch/minor releases unless explicitly documented:

- Exported symbols listed in `PUBLIC_API.md`
- `TypesetResult` top-level shape: `{ pages, diagnostics }`
- `SourceSpan` fields: `start`, `end`, `kind`
- Public option names/default behavior (`TypesetOptions`, `TypesetFeatureOptions`)
- Renderer entrypoints: `renderToCanvas`, `renderToPdf`
- Default PDF behavior: custom fonts are subset to used glyphs (`PdfOptions.fontSubsetting` defaults to `true`)
- Optional PDF emoji image-cache mode: `PdfOptions.emojiRenderMode = "imageCache"`

Intentionally non-stable/internal:

- Internal modules under `src/layout/*`, `src/math/*`, `src/markdown.ts`, `src/font-metrics.ts`
- Normalized/internal types not exported from package entrypoint
- Internal parser/layout implementation details that do not change public result contracts

## Emoji Fallback Expectations

- Emoji layout spacing remains deterministic even when no emoji font file is available.
- Full-color emoji appearance requires an emoji-capable fallback font in `fonts.fallback[]`.
- Recommended fallback order:
1. Emoji font (for example Noto Emoji)
2. Mono fallback font
3. Math font

If emoji appears monochrome, tofu, or style-inconsistent:

1. Ensure a dedicated emoji font is loaded and present in `fonts.fallback[]`.
2. Confirm the font actually contains the code points you render.
3. Check platform/browser font substitution differences.

### Optional Emoji Suppression

For compact exports or strict text-only output, suppress emoji during typesetting:

```ts
features: {
  emoji: {
    mode: "suppress",
    replacement: "~" // optional, defaults to "~"
  }
}
```

When enabled, each emoji grapheme is replaced before layout in both Canvas and PDF paths.

### Optional PDF Emoji Image Cache

To preserve emoji-like visuals while avoiding heavy emoji font embedding in PDFs:

```ts
const pdf = await typesetter.renderToPdf(result.pages, {
  emojiRenderMode: "imageCache"
});
```

This mode rasterizes each unique emoji grapheme once and reuses that embedded image across pages.
If image rasterization is unavailable, rendering falls back to normal font-based PDF text output;
when the active PDF font cannot encode that grapheme, the renderer substitutes `~`.

## Release Handoff Checklist

When handing package updates to app teams:

1. Specify payload type:
   - `dist` only (recommended for consumers)
   - `source + dist` (for deep debugging/custom builds)
2. Include `PUBLIC_API.md`, `INTEGRATION.md`, and `CHANGELOG.md`.
3. Verify these commands in a clean consumer install:
   - `pnpm install`
   - `pnpm --filter canvadoc-typesetter typecheck`
   - `pnpm --filter canvadoc-typesetter test`
4. Run a basic end-to-end smoke:
   - typeset markdown
   - canvas render
   - pdf export

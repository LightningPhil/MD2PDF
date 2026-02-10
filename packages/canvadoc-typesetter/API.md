# CanvaDoc Typesetter API

A deterministic markdown-to-PDF typesetter that renders identical content to both HTML Canvas and PDF.

## Installation

```bash
pnpm add canvadoc-typesetter
```

## Quick Start

```typescript
import { createTypesetter, loadFontSpecFromUrl } from 'canvadoc-typesetter';

// Load fonts
const textFont = await loadFontSpecFromUrl('libertinus', '/fonts/LibertinusSerif-Regular.otf', 'Libertinus Serif');
const mathFont = await loadFontSpecFromUrl('stix', '/fonts/STIXTwoMath-Regular.otf', 'STIX Two Math');
const monoFont = await loadFontSpecFromUrl('plex', '/fonts/IBMPlexMono-Regular.ttf', 'IBM Plex Mono');

// Create typesetter
const typesetter = createTypesetter({
  page: {
    size: 'A4',
    marginPt: { top: 72, right: 72, bottom: 72, left: 72 }
  },
  typography: {
    baseFontSizePt: 12,
    lineHeight: 1.4,
    paragraphSpacingPt: 12,
    headingScale: { h1: 2.0, h2: 1.5, h3: 1.2 }
  },
  fonts: {
    text: textFont,
    math: mathFont,
    mono: monoFont
  }
});

// Typeset markdown
const markdown = `# Hello World

This is a paragraph with inline math: $E = mc^2$.

$$\sum_{i=1}^{n} x_i = \frac{a}{b}$$
`;

const { pages, diagnostics } = await typesetter.typeset(markdown);

// Render to canvas
typesetter.renderToCanvas(pages, canvasElement, { zoom: 1.5 });

// Generate PDF
const pdfBytes = await typesetter.renderToPdf(pages, { title: 'My Document' });
```

## API Reference

### `createTypesetter(options: TypesetOptions): Typesetter`

Creates a new typesetter instance.

#### Parameters

- `options: TypesetOptions` - Configuration for page layout, typography, and fonts

#### Returns

A `Typesetter` instance with methods for typesetting and rendering.

---

### `loadFontSpecFromUrl(id: string, url: string, cssFamily?: string): Promise<FontSpec>`

Loads a font file from a URL and returns a font specification.

#### Parameters

- `id: string` - Unique identifier for the font
- `url: string` - URL to fetch the font file from
- `cssFamily?: string` - Optional CSS font-family name for canvas rendering

#### Returns

Promise resolving to a `FontSpec` object.

---

### `mmToPt(mm: number): number`

Converts millimeters to points (1pt = 1/72 inch).

---

## Types

### `TypesetOptions`

Main configuration object for the typesetter.

```typescript
type TypesetOptions = {
  page: {
    size: PageSize;           // "A4" or { widthPt, heightPt }
    marginPt: MarginPt;       // { top, right, bottom, left }
  };
  typography: {
    baseFontSizePt: number;   // Base font size (default: 12)
    lineHeight: number;       // Line height multiplier (default: 1.4)
    paragraphSpacingPt: number; // Space between paragraphs
    headingScale: {           // Scale factors for headings
      h1: number;
      h2: number;
      h3: number;
    };
  };
  fonts: {
    text: FontSpec;           // Primary text font
    math: FontSpec;           // Math font
    mono?: FontSpec;          // Monospace font for code
  };
  features?: TypesetFeatureOptions;
};
```

### `TypesetFeatureOptions`

Optional feature configuration.

```typescript
type TypesetFeatureOptions = {
  tables?: boolean;           // Enable table rendering (default: true)
  codeBlocks?: {
    background?: boolean;     // Show background (default: true)
    border?: boolean;         // Show border (default: true)
    lineNumbers?: boolean;    // Show line numbers (default: false)
    wrapLongLines?: boolean;  // Wrap long lines (default: true)
    paddingPt?: number;       // Inner padding (default: 8)
    tabSize?: number;         // Spaces per tab (default: 4)
  };
  math?: {
    environments?: boolean;   // Enable math environments (default: true)
    stretchyDelimiters?: 'scale' | 'assemble' | 'off'; // Delimiter mode
    accents?: boolean;        // Enable accents (default: true)
    bigOperators?: boolean;   // Enable big operators (default: true)
  };
};
```

### `Typesetter`

The main typesetter interface.

```typescript
interface Typesetter {
  typeset(markdown: string): Promise<TypesetResult>;
  renderToCanvas(pages: PageLayout[], canvas: HTMLCanvasElement, view: CanvasViewOptions): void;
  renderToPdf(pages: PageLayout[], pdfOptions?: PdfOptions): Promise<Uint8Array>;
}
```

### `TypesetResult`

Result of typesetting a document.

```typescript
type TypesetResult = {
  pages: PageLayout[];        // Array of laid out pages
  diagnostics: {
    warnings: string[];       // Non-fatal issues
    errors: string[];         // May affect output quality
    timingsMs?: Record<string, number>;
  };
};
```

### `PageLayout`

Layout information for a single page.

```typescript
type PageLayout = {
  index: number;              // Zero-based page index
  widthPt: number;            // Page width in points
  heightPt: number;           // Page height in points
  ops: DrawOp[];              // Drawing operations
};
```

### `CanvasViewOptions`

Options for canvas rendering.

```typescript
type CanvasViewOptions = {
  zoom: number;               // Zoom level (1 = 100%)
  pageGapPt: number;          // Gap between pages
  background: 'white' | 'transparent';
  mode: 'stackedPages' | 'singlePage';
  pageIndex?: number;         // Page to show in singlePage mode
};
```

### `PdfOptions`

Options for PDF generation.

```typescript
type PdfOptions = {
  title?: string;             // PDF document title
  author?: string;            // PDF document author
};
```

### `DrawOp`

Union type of all drawing operations produced by the layout engine.

```typescript
type DrawOp = GlyphOp | GlyphRunOp | RuleOp | DebugBoxOp;

// Single glyph
type GlyphOp = {
  kind: 'glyph';
  fontId: string;
  fontSizePt: number;
  xPt: number;
  yBaselinePt: number;
  char: string;
  sourceSpan?: SourceSpan;
};

// Batched text run
type GlyphRunOp = {
  kind: 'glyphRun';
  fontId: string;
  fontSizePt: number;
  xPt: number;
  yBaselinePt: number;
  text: string;
  xOffsetsPt?: number[];
  sourceSpan?: SourceSpan;
};

// Filled rectangle (rules, borders, backgrounds)
type RuleOp = {
  kind: 'rule';
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
  colorRgb?: [number, number, number];
};
```

## Supported Markdown

### Block Elements

- **Headings**: `#`, `##`, `###` (H1-H3)
- **Paragraphs**: Regular text with blank line separation
- **Unordered Lists**: `- Item`
- **Ordered Lists**: `1. Item`
- **Code Blocks**: Triple backticks with optional language tag
- **Display Math**: `$$...$$` (single or multi-line)
- **Tables**: Pipe tables with alignment markers
- **Horizontal Rules**: `---`

### Inline Elements

- **Inline Math**: `$...$`
- **Inline Code**: Backticks

## Supported Math

### Symbols

- **Greek Letters**: `\alpha`, `\beta`, `\gamma`, `\Gamma`, `\Delta`, etc. (full alphabet)
- **Operators**: `\pm`, `\mp`, `\times`, `\div`, `\cdot`
- **Comparisons**: `\le`, `\ge`, `\ll`, `\gg`, `\neq`, `\approx`, `\sim`, `\cong`, `\propto`
- **Logic**: `\forall`, `\exists`, `\land`, `\lor`, `\lnot`, `\implies`, `\iff`
- **Sets**: `\in`, `\notin`, `\subset`, `\subseteq`, `\cup`, `\cap`, `\emptyset`
- **Arrows**: `\to`, `\rightarrow`, `\leftarrow`, `\Rightarrow`, `\mapsto`, `\uparrow`, `\downarrow`
- **Calculus**: `\nabla`, `\partial`, `\infty`
- **Misc**: `\angle`, `\perp`, `\parallel`, `\ell`, `\cdots`, `\ldots`, `\vdots`, `\ddots`

### Structures

- **Fractions**: `\frac{num}{denom}`, `\dfrac`, `\tfrac`
- **Roots**: `\sqrt{expr}`, `\sqrt[n]{expr}`
- **Superscripts/Subscripts**: `x^2`, `x_i`, `x_i^2`
- **Delimiters**: `\left( ... \right)`, with auto-scaling
- **Big Operators**: `\sum`, `\prod`, `\int`, `\iint`, `\iiint`, `\oint`, `\bigcup`, `\bigcap`
- **Limits**: `\lim_{x \to \infty}`

### Environments

- **Aligned**: `\begin{aligned}...\end{aligned}` (with `&` alignment, `\\` rows)
- **Gather**: `\begin{gather}...\end{gather}` (centered rows)
- **Cases**: `\begin{cases}...\end{cases}` (piecewise functions)
- **Matrices**: `\begin{matrix}`, `\begin{pmatrix}`, `\begin{bmatrix}`, `\begin{vmatrix}`, `\begin{Vmatrix}`
- **Array**: `\begin{array}{lcr}...\end{array}` (with column alignments)

### Styles

- `\mathrm{text}` - Roman (upright)
- `\mathbf{text}` - Bold
- `\mathit{text}` - Italic
- `\mathbb{R}` - Blackboard bold
- `\mathcal{A}` - Calligraphic
- `\text{words}` - Plain text in math

### Spacing

- `\,` - Thin space
- `\:` - Medium space
- `\;` - Thick space
- `\quad` - Quad space
- `\qquad` - Double quad space

## Coordinate System

- All measurements are in **points** (1pt = 1/72 inch)
- Internal coordinates use **y-down** (origin at top-left)
- PDF output transforms to **y-up** (origin at bottom-left)
- Canvas and PDF renders are pixel-identical

## Performance

Benchmarks on a typical machine:
- Parse 8-10 page document: ~0.2ms
- Parse complex math expression: ~0.01ms
- Full typeset of 10 pages: < 200ms (target)

## Known Limitations

- Accents (`\bar`, `\hat`, `\vec`) use prefix glyphs, not positioned marks
- Stretchy delimiters use scaling, not glyph assembly
- No macro support (`\newcommand`, `\def`)
- No images or figures
- No table cell spanning (rowspan/colspan)
- No nested lists
- No hyphenation or justification
- No syntax highlighting for code blocks

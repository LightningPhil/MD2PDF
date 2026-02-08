# MD2PDF - Markdown to Paginated A4 Preview

A web application that loads/edits Markdown and renders it live as paginated A4-style pages with KaTeX math support.

## Features

- **Split-pane Interface**: Markdown editor on the left, paginated A4 preview on the right
- **Live Preview**: Real-time rendering as you type
- **KaTeX Math Support**: Render mathematical expressions with toggle between HTML and SVG modes
- **Smart Pagination**: A4-sized pages with intelligent page breaks that avoid splitting equations or tables
- **File Handling**: Upload and save Markdown files
- **Drag & Drop**: Drag .md files directly into the application

## Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to use the application.

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Other Commands

- `npm run typecheck` - Check TypeScript types
- `npm test` - Run unit tests with Vitest
- `npm run preview` - Preview the built application

### Testing

Run the automated test suite:
```bash
npm test
```

For manual testing procedures, see [MANUAL_TESTING.md](MANUAL_TESTING.md).

## Usage

1. **Editing**: Type or paste Markdown content in the left pane
2. **Math**: Use `$inline math$` for inline equations and `$$display math$$` for block equations
3. **Upload**: Click the 📁 Upload button or drag a .md file into the app  
4. **Save**: Click the 💾 Save button to download your markdown
5. **Math Mode**: Toggle between HTML and SVG rendering using the 🧮 Math button

## Supported Markdown Features

- Headings (H1-H6)
- Paragraphs and text formatting (bold, italic)  
- Lists (ordered and unordered)
- Code blocks and inline code
- Tables
- Images
- Horizontal rules
- Math expressions (inline: `$...$`, display: `$$...$$`)

## Project Structure

```
/
├── src/
│   ├── main.ts        # Application entry point
│   ├── editor.ts      # Markdown editor functionality
│   ├── markdown.ts    # Markdown parsing
│   ├── katex.ts       # Math rendering with KaTeX  
│   ├── paginator.ts   # Pagination logic
│   ├── pages.ts       # Page management
│   └── ui.ts          # UI controls and interactions
├── tests/             # Unit tests (Vitest)
├── index.html         # Main HTML template
├── style.css          # Application styles
└── package.json       # Dependencies and scripts
```

## Phase 1 Scope

This is Phase 1 of the MD2PDF project, focusing on preview functionality. Currently supported:

✅ Markdown editing and live preview  
✅ A4-style paginated layout  
✅ KaTeX math rendering (HTML/SVG modes)  
✅ Smart page breaks  
✅ File upload/download  

**Not included in Phase 1** (planned for Phase 2):
- PDF generation
- Font embedding  
- Print dialogs
- Server-side rendering

## Contributing

This project follows the specifications in `ProjectPlan.md`. Please refer to that document for detailed requirements and constraints.

## License

MIT License - see LICENSE file for details.

## Author

Philip Leichauer
# IIS Deployment Guide for MD2PDF

## Overview
MD2PDF is now configured to run as a static web application on IIS from **any directory**. All paths are relative, so you can deploy it to any folder structure. There are **no server-side dependencies** or API endpoints - everything runs client-side.

## Deployment Steps

1. **Build the project** (already done):
   ```bash
   npm run build
   ```

2. **Copy files to any IIS directory**:
   - Copy everything from the `dist/` folder to your desired IIS location
   - Examples: 
     - `C:\inetpub\wwwroot\MD2PDF\`
     - `C:\inetpub\wwwroot\apps\markdown\`
     - `C:\inetpub\wwwroot\tools\md2pdf\`

3. **IIS Configuration**:
   - Create a virtual directory or application at your chosen path
   - Point it to your copied files
   - No special configuration needed - it's a static site

## File Structure (any directory)
```
Your-Chosen-Directory\
├── index.html          (main app)
├── assets/             (JS/CSS bundles)  
│   ├── index-CuegdCac.js
│   └── index-D_fBXIeZ.css
└── fonts/              (font files)
    ├── SourceSerif4-Regular.otf
    ├── SourceSerif4-Bold.otf
    ├── SourceSerif4-Italic.otf
    ├── SourceSerif4-BoldItalic.otf
    ├── STIXTwoMath-Regular.otf
    └── IBMPlexMono-Regular.otf
```

## Access Examples
- `http://localhost/MD2PDF` 
- `http://localhost/apps/markdown/`
- `http://localhost/tools/md2pdf/`
- Works from any subdirectory path
- All functionality works client-side (no server required)
- PDF export works entirely in the browser

## No API Required
✅ Client-side markdown rendering  
✅ Client-side canvas drawing  
✅ Client-side PDF generation  
❌ No headless browser  
❌ No Node.js server  
❌ No API endpoints  

## Build Configuration
The project is configured with:
- `base: './'` in vite.config.ts (relative paths)
- Relative font paths (`./fonts/`)
- Static asset optimization
- Works from any directory structure

## Troubleshooting
- If fonts don't load, ensure all files in `dist/fonts/` are copied
- If CSS/JS doesn't load, check that `assets/` folder is copied
- All paths are relative to the `/MD2PDF/` base path
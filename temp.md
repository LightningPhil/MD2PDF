# MD2PDF Install Instructions (for Copilot)

Run these commands from the project root:
`c:\Users\PhilipLeichauer\Desktop\WEB Dev\MD2PDF`

## 1. Prerequisites

- Node.js 18+ installed
- npm available in terminal

Optional check:

```powershell
node -v
npm -v
```

## 2. Install project dependencies

```powershell
npm install
```

## 3. Install Playwright Chromium

```powershell
npx playwright install chromium
```

If `npx` has issues, use:

```powershell
npm exec playwright install chromium
```

## 4. Verify setup

```powershell
npx playwright --version
npm run typecheck
npm run build
```

## 5. Quick PDF export smoke test

```powershell
npm run export:pdf -- --input samples/sample.md --output dist/exports/sample.pdf --page-size a4
```

If this command succeeds, setup is complete.

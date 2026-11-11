# Local installation notes

Use Node.js 24 or newer and run commands from the repository root. Current commands come from [package.json](package.json); see [README](README.md) for authoring and export.

```powershell
npm ci
npm run typecheck
npm run test:coverage
npm run build
npm run build:pages
node scripts/check-audit-coverage.mjs
```

For an authorized live test, install Playwright Chromium with `npx playwright install chromium`, then run `npm run test:e2e` and `npm run test:pages`. These commands launch browsers/servers. For manual work, `npm run dev` prints the local URL.

PDF export uses Export PDF → Start export → the browser’s Save as PDF destination. There is no `export:pdf` CLI or server compiler. Follow [MANUAL_TESTING.md](MANUAL_TESTING.md) for the deferred live campaign.

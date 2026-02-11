# Changelog

## [0.1.0] - 2026-02-10

### Added

- Public API contract documentation (`PUBLIC_API.md`).
- Runtime metadata exports:
  - `CANVADOC_TYPESETTER_VERSION`
  - `CANVADOC_TYPESETTER_CAPABILITIES`
  - `CANVADOC_TYPESETTER_METADATA`
  - `getCanvaDocTypesetterMetadata()`
- Consumer contract smoke tests (`src/consumer-contract.test.ts`).
- Integration guide (`INTEGRATION.md`).
- API snapshot guardrail (`api/public-api.snapshot.d.ts`) with `api:check`.

### Integration Impact

- Breaking changes: none.
- Optional behavior changes:
  - Emoji behavior is now explicitly documented as deterministic spacing with optional font-driven appearance improvements.
- Required consumer actions:
  - None for existing `createTypesetter` workflows.
  - Integrators can optionally read runtime capabilities/version from metadata exports.

## Unreleased

### Added

- Emoji suppression mode with configurable replacement marker via `TypesetOptions.features.emoji`.
- PDF emoji image-cache mode via `PdfOptions.emojiRenderMode = "imageCache"`.

### Changed

- PDF renderer now embeds only fonts referenced by draw ops.
- PDF renderer now subsets custom fonts by default (`PdfOptions.fontSubsetting = true`).

### Integration Impact

- Breaking changes:
- Optional behavior changes:
  - PDFs containing emoji/fallback fonts are typically much smaller due to used-font embedding + subsetting.
  - Emoji can now be suppressed/replaced at layout time for deterministic text-only output.
  - PDFs can preserve emoji appearance via reusable cached image assets instead of embedding emoji fonts.
  - If emoji image caching is unavailable and the fallback PDF font cannot encode a grapheme, it is replaced with `~`.
- Required consumer actions:
  - None. If required, legacy non-subset behavior can be restored with `renderToPdf(..., { fontSubsetting: false })`.

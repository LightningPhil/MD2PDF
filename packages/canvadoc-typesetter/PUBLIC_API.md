# canvadoc-typesetter Public API Contract

The supported public API is the package entrypoint (`canvadoc-typesetter`) only.
Anything not exported from `src/index.ts` is internal and may change without notice.

## Runtime Exports

- `createTypesetter(options)`
- `loadFontSpecFromUrl(id, url, cssFamily?)`
- `mmToPt(mm)`
- `getCanvaDocTypesetterMetadata()`
- `CANVADOC_TYPESETTER_VERSION`
- `CANVADOC_TYPESETTER_CAPABILITIES`
- `CANVADOC_TYPESETTER_METADATA`

## Type Exports

- `CanvasViewOptions`
- `DrawOp`
- `FontSpec`
- `HeaderFooterConfig`
- `MarginConfig`
- `MarginPt`
- `MarginPreset`
- `PageLayout`
- `PageSize`
- `PageSizePreset`
- `PdfOptions`
- `SourceSpan`
- `TypesetDiagnostics`
- `TypesetFeatureOptions`
- `TypesetOptions`
- `TypesetResult`
- `Typesetter`
- `TypesetterCapabilities`
- `TypesetterRuntimeMetadata`

## Compatibility Policy

- Patch/minor releases keep this surface stable unless explicitly documented.
- Removing/renaming public exports is a breaking change.
- Public API changes must be documented in `CHANGELOG.md` under `Integration Impact`.

## CI/API Guardrail

- API contract snapshot file: `api/public-api.snapshot.d.ts`
- Check command: `pnpm run build && pnpm run api:check`
- Intentional contract update flow:
1. Edit public exports.
2. Run `pnpm run build`.
3. Run `pnpm run api:update`.
4. Add compatibility notes in `CHANGELOG.md`.

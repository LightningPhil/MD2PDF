import { describe, expect, it } from 'vitest'
import { createDefaultOptions, normalizeOptions } from '../src/typesetter-engine/options'
import type { FontSpec, TypesetOptions } from '../src/typesetter-engine/types'

function createFont(id: string): FontSpec {
  return {
    id,
    source: new ArrayBuffer(0),
    cssFamily: id,
  }
}

function createOptions(
  typographyOverrides: Partial<TypesetOptions['typography']> = {},
): TypesetOptions {
  return {
    page: {
      size: 'A4',
      margin: 'Medium',
    },
    typography: {
      baseFontSizePt: 12,
      lineHeight: 1.4,
      paragraphSpacingPt: 12,
      headingScale: { h1: 2, h2: 1.5, h3: 1.2 },
      ...typographyOverrides,
    },
    fonts: {
      text: createFont('text'),
      math: createFont('math'),
      mono: createFont('mono'),
    },
  }
}

describe('typesetter options typography sizing', () => {
  it('preserves explicit table/code font sizes through defaults and normalization', () => {
    const options = createOptions({
      tableFontSizePt: 9.25,
      codeFontSizePt: 8.5,
      headingScale: { h1: 2.2, h2: 1.7, h3: 1.35 },
    })

    const merged = createDefaultOptions(options)
    const normalized = normalizeOptions(merged)

    expect(merged.typography.tableFontSizePt).toBe(9.25)
    expect(merged.typography.codeFontSizePt).toBe(8.5)
    expect(normalized.typography.tableFontSizePt).toBe(9.25)
    expect(normalized.typography.codeFontSizePt).toBe(8.5)
    expect(normalized.typography.headingScale).toEqual({ h1: 2.2, h2: 1.7, h3: 1.35 })
  })

  it('leaves table/code font sizes unset when no explicit override is provided', () => {
    const options = createOptions()
    const merged = createDefaultOptions(options)
    const normalized = normalizeOptions(merged)

    expect(merged.typography.tableFontSizePt).toBeUndefined()
    expect(merged.typography.codeFontSizePt).toBeUndefined()
    expect(normalized.typography.tableFontSizePt).toBeUndefined()
    expect(normalized.typography.codeFontSizePt).toBeUndefined()
  })
})

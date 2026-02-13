/**
 * Emoji helpers used by metrics/layout when no dedicated emoji font is available.
 *
 * Goal:
 * - Detect graphemes that should behave like emoji (roughly square advance).
 * - Strip joiner/presentation controls when probing glyph support.
 */

const ZWJ = 0x200d;
const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const KEYCAP_COMBINING = 0x20e3;
const TAG_START = 0xe0020;
const TAG_END = 0xe007f;
const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;

// Broad Unicode blocks that contain modern emoji presentation glyphs.
const MODERN_EMOJI_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x1f000, 0x1faff],
  [REGIONAL_INDICATOR_START, REGIONAL_INDICATOR_END]
];

// Legacy BMP ranges where many default-emoji symbols live (for regex-less fallback paths).
const LEGACY_EMOJI_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x2300, 0x23ff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf]
];

let emojiPresentationRegex: RegExp | null | undefined;
let extendedPictographicRegex: RegExp | null | undefined;

/**
 * Returns true when the grapheme is likely to be rendered as an emoji glyph box.
 * This intentionally favors recall over precision so spacing does not collapse.
 */
export function shouldUseEmojiMetricsFallback(grapheme: string): boolean {
  if (!grapheme) {
    return false;
  }

  let regionalIndicatorCount = 0;
  let hasEmojiBaseCodePoint = false;
  for (const part of Array.from(grapheme)) {
    const code = part.codePointAt(0);
    if (code === undefined) {
      continue;
    }

    if (code === VS16 || code === ZWJ || code === KEYCAP_COMBINING) {
      return true;
    }

    if (code >= REGIONAL_INDICATOR_START && code <= REGIONAL_INDICATOR_END) {
      regionalIndicatorCount += 1;
      if (regionalIndicatorCount >= 2) {
        return true;
      }
    }

    for (const [start, end] of MODERN_EMOJI_BLOCKS) {
      if (code >= start && code <= end) {
        hasEmojiBaseCodePoint = true;
        break;
      }
    }

    if (hasEmojiBaseCodePoint) {
      continue;
    }

    for (const [start, end] of LEGACY_EMOJI_BLOCKS) {
      if (code >= start && code <= end) {
        hasEmojiBaseCodePoint = true;
        break;
      }
    }

    if (hasEmojiBaseCodePoint) {
      continue;
    }

    if (isEmojiByUnicodeProperty(part)) {
      hasEmojiBaseCodePoint = true;
    }
  }

  return hasEmojiBaseCodePoint;
}

/**
 * Return codepoint parts that must be covered by a font for grapheme support.
 * Joins/selectors are ignored because they are shaping controls, not standalone glyphs.
 */
export function getRenderableGraphemeParts(grapheme: string): string[] {
  const out: string[] = [];
  for (const part of Array.from(grapheme)) {
    const code = part.codePointAt(0);
    if (code === undefined) {
      continue;
    }
    if (
      code === ZWJ ||
      code === VS15 ||
      code === VS16 ||
      code === KEYCAP_COMBINING ||
      (code >= TAG_START && code <= TAG_END)
    ) {
      continue;
    }
    out.push(part);
  }
  return out;
}

function isEmojiByUnicodeProperty(part: string): boolean {
  const presentation = getEmojiPresentationRegex();
  if (presentation && presentation.test(part)) {
    return true;
  }

  const pictographic = getExtendedPictographicRegex();
  return pictographic ? pictographic.test(part) : false;
}

function getEmojiPresentationRegex(): RegExp | null {
  if (emojiPresentationRegex !== undefined) {
    return emojiPresentationRegex;
  }

  try {
    emojiPresentationRegex = new RegExp("\\p{Emoji_Presentation}", "u");
  } catch {
    emojiPresentationRegex = null;
  }

  return emojiPresentationRegex;
}

function getExtendedPictographicRegex(): RegExp | null {
  if (extendedPictographicRegex !== undefined) {
    return extendedPictographicRegex;
  }

  try {
    extendedPictographicRegex = new RegExp("\\p{Extended_Pictographic}", "u");
  } catch {
    extendedPictographicRegex = null;
  }

  return extendedPictographicRegex;
}

/**
 * Split text into grapheme clusters so emoji and combined symbols stay intact.
 * Falls back to code points when Intl.Segmenter is unavailable.
 */

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

let cachedSegmenter: GraphemeSegmenter | null | undefined;

export function splitGraphemes(input: string): string[] {
  if (!input) {
    return [];
  }

  const segmenter = getSegmenter();
  if (!segmenter) {
    return Array.from(input);
  }

  const out: string[] = [];
  for (const part of segmenter.segment(input)) {
    out.push(part.segment);
  }
  return out;
}

function getSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter !== undefined) {
    return cachedSegmenter;
  }

  const intl = Intl as unknown as {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity?: "grapheme" | "word" | "sentence" }
    ) => GraphemeSegmenter;
  };

  if (typeof intl.Segmenter !== "function") {
    cachedSegmenter = null;
    return cachedSegmenter;
  }

  cachedSegmenter = new intl.Segmenter(undefined, { granularity: "grapheme" });
  return cachedSegmenter;
}

declare module "opentype.js" {
  type Glyph = {
    advanceWidth?: number;
  };

  type ParsedFont = {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    charToGlyph: (char: string) => Glyph;
  };

  const opentype: {
    parse: (buffer: ArrayBuffer) => ParsedFont;
  };

  export default opentype;
}

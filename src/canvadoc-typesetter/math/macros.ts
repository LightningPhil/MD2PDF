/**
 * Safe math macro expansion.
 *
 * Purpose:
 * - Expand a constrained subset of TeX macro definitions before parsing.
 * - Enforce deterministic resource limits (depth, output length, definitions).
 *
 * Usage:
 * - Called by `layoutMathExpression` before AST parsing.
 * - Throws explicit errors for invalid/recursive/unbounded macro usage.
 */
export type MathMacroExpansionOptions = {
  maxDepth?: number;
  maxOutputLength?: number;
  maxDefinitions?: number;
};

type ExpansionState = {
  outputLength: number;
};

const DEFAULT_OPTIONS: Required<MathMacroExpansionOptions> = {
  maxDepth: 16,
  maxOutputLength: 10_000,
  maxDefinitions: 256
};

export function expandMathMacros(
  input: string,
  options?: MathMacroExpansionOptions
): string {
  const limits = {
    ...DEFAULT_OPTIONS,
    ...(options ?? {})
  };
  const macros = new Map<string, string>();
  const state: ExpansionState = { outputLength: 0 };
  return expandSegment(input, macros, limits, state, true, []);
}

function expandSegment(
  input: string,
  macros: Map<string, string>,
  limits: Required<MathMacroExpansionOptions>,
  state: ExpansionState,
  allowDefinitions: boolean,
  stack: string[]
): string {
  let i = 0;
  let out = "";

  const append = (value: string): void => {
    if (!value) {
      return;
    }
    state.outputLength += value.length;
    if (state.outputLength > limits.maxOutputLength) {
      throw new Error("Macro expansion exceeded maximum output length");
    }
    out += value;
  };

  while (i < input.length) {
    if (allowDefinitions && input.startsWith("\\newcommand", i)) {
      // Definitions are consumed in-order so later invocations see earlier macros.
      i = parseNewCommand(input, i, macros, limits);
      continue;
    }

    const ch = input[i];
    if (ch !== "\\") {
      append(ch);
      i += 1;
      continue;
    }

    const token = readCommandToken(input, i);
    if (/^[A-Za-z]+$/.test(token.name) && macros.has(token.name)) {
      append(expandMacro(token.name, macros, limits, state, stack));
      i = token.end;
      continue;
    }

    append(token.raw);
    i = token.end;
  }

  return out;
}

function expandMacro(
  macroName: string,
  macros: Map<string, string>,
  limits: Required<MathMacroExpansionOptions>,
  state: ExpansionState,
  stack: string[]
): string {
  if (stack.length >= limits.maxDepth) {
    throw new Error(`Macro expansion depth exceeded for \\${macroName}`);
  }
  if (stack.includes(macroName)) {
    throw new Error(`Recursive macro detected: \\${macroName}`);
  }

  const replacement = macros.get(macroName);
  if (replacement === undefined) {
    return `\\${macroName}`;
  }

  const nextStack = [...stack, macroName];
  return expandSegment(replacement, macros, limits, state, false, nextStack);
}

function parseNewCommand(
  input: string,
  start: number,
  macros: Map<string, string>,
  limits: Required<MathMacroExpansionOptions>
): number {
  let cursor = start + "\\newcommand".length;
  cursor = skipWhitespace(input, cursor);

  const nameGroup = readBraceGroup(input, cursor);
  const macroNameRaw = nameGroup.value.trim();
  if (!/^\\[A-Za-z]+$/.test(macroNameRaw)) {
    throw new Error("Invalid \\newcommand name; expected {\\name}");
  }
  const macroName = macroNameRaw.slice(1);

  cursor = skipWhitespace(input, nameGroup.end);
  if (input[cursor] === "[") {
    throw new Error("Unsupported: \\newcommand with parameters");
  }

  const replacementGroup = readBraceGroup(input, cursor);
  macros.set(macroName, replacementGroup.value);
  if (macros.size > limits.maxDefinitions) {
    throw new Error("Macro definition limit exceeded");
  }
  return replacementGroup.end;
}

function readCommandToken(
  input: string,
  start: number
): { raw: string; name: string; end: number } {
  let cursor = start + 1;
  if (cursor >= input.length) {
    return { raw: "\\", name: "", end: cursor };
  }

  if (/[A-Za-z]/.test(input[cursor])) {
    const nameStart = cursor;
    while (cursor < input.length && /[A-Za-z]/.test(input[cursor])) {
      cursor += 1;
    }
    return {
      raw: input.slice(start, cursor),
      name: input.slice(nameStart, cursor),
      end: cursor
    };
  }

  cursor += 1;
  return {
    raw: input.slice(start, cursor),
    name: input.slice(start + 1, cursor),
    end: cursor
  };
}

function skipWhitespace(input: string, start: number): number {
  let cursor = start;
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function readBraceGroup(
  input: string,
  start: number
): { value: string; end: number } {
  const open = skipWhitespace(input, start);
  if (input[open] !== "{") {
    throw new Error("Expected brace group");
  }

  let depth = 1;
  const contentStart = open + 1;
  let cursor = contentStart;

  while (cursor < input.length) {
    const ch = input[cursor];
    if (ch === "\\" && cursor + 1 < input.length) {
      cursor += 2;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          value: input.slice(contentStart, cursor),
          end: cursor + 1
        };
      }
      cursor += 1;
      continue;
    }
    cursor += 1;
  }

  throw new Error("Unterminated brace group in macro definition");
}

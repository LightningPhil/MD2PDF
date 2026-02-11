import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distDtsPath = path.join(packageRoot, "dist", "index.d.ts");
const snapshotPath = path.join(packageRoot, "api", "public-api.snapshot.d.ts");
const packageJsonPath = path.join(packageRoot, "package.json");
const indexSourcePath = path.join(packageRoot, "src", "index.ts");

function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(distDtsPath)) {
  fail(
    `Missing ${path.relative(packageRoot, distDtsPath)}. Run "pnpm run build" in packages/canvadoc-typesetter first.`
  );
}

if (!existsSync(snapshotPath)) {
  fail(
    `Missing ${path.relative(packageRoot, snapshotPath)}. Run "pnpm run api:update" to create the public API snapshot.`
  );
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const sourceIndex = readFileSync(indexSourcePath, "utf8");
const versionMatch = sourceIndex.match(
  /export const CANVADOC_TYPESETTER_VERSION = "([^"]+)";/
);

if (!versionMatch) {
  fail(
    "Could not find CANVADOC_TYPESETTER_VERSION in src/index.ts. Keep the runtime version export aligned with package.json."
  );
}

if (versionMatch[1] !== packageJson.version) {
  fail(
    [
      "Version mismatch:",
      `- package.json: ${packageJson.version}`,
      `- src/index.ts CANVADOC_TYPESETTER_VERSION: ${versionMatch[1]}`,
      "Update src/index.ts and refresh the API snapshot before releasing."
    ].join("\n")
  );
}

const actual = normalize(readFileSync(distDtsPath, "utf8"));
const expected = normalize(readFileSync(snapshotPath, "utf8"));

if (actual !== expected) {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const maxLines = Math.max(actualLines.length, expectedLines.length);
  let firstDiffLine = -1;

  for (let i = 0; i < maxLines; i += 1) {
    if ((actualLines[i] ?? "") !== (expectedLines[i] ?? "")) {
      firstDiffLine = i + 1;
      break;
    }
  }

  const diffHint =
    firstDiffLine > 0
      ? [
          `First difference at line ${firstDiffLine}:`,
          `- expected: ${expectedLines[firstDiffLine - 1] ?? "<EOF>"}`,
          `- actual:   ${actualLines[firstDiffLine - 1] ?? "<EOF>"}`
        ].join("\n")
      : "Public API differs from snapshot.";

  fail(
    [
      "Public API contract check failed.",
      diffHint,
      'Run "pnpm run api:update" only when intentionally changing public exports, then document the change in CHANGELOG.md under "Integration Impact".'
    ].join("\n")
  );
}

console.log("Public API contract check passed.");

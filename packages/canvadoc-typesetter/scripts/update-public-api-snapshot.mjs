import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distDtsPath = path.join(packageRoot, "dist", "index.d.ts");
const snapshotPath = path.join(packageRoot, "api", "public-api.snapshot.d.ts");

function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
}

let distContents;
try {
  distContents = readFileSync(distDtsPath, "utf8");
} catch {
  console.error(
    `Missing ${path.relative(packageRoot, distDtsPath)}. Run "pnpm run build" in packages/canvadoc-typesetter first.`
  );
  process.exit(1);
}

mkdirSync(path.dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, normalize(distContents), "utf8");
console.log(`Updated ${path.relative(packageRoot, snapshotPath)}.`);

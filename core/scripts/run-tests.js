// Discover *.test.ts files under tests/ and run them via node:test + tsx.
// Kept dependency-free; works cross-platform without relying on shell globbing.
//
// Args:
//   --flag        Forwarded to the inner `node` invocation (e.g.,
//                 --experimental-test-coverage).
//   <pattern>     Optional positional file-name pattern (no slashes).
//                 If one or more are passed, only tests whose basename
//                 matches one of the patterns run. Default: every
//                 *.test.ts under tests/.
//
// Examples:
//   node scripts/run-tests.js                         # everything
//   node scripts/run-tests.js corpus.test.ts          # corpus only
//   node scripts/run-tests.js --experimental-test-coverage  # everything + coverage

import { glob } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

const args = process.argv.slice(2);
const forwardedFlags = args.filter((a) => a.startsWith("--"));
const patterns = args.filter((a) => !a.startsWith("--"));

const allFiles = [];
for await (const file of glob("tests/**/*.test.ts")) {
  allFiles.push(file);
}

const files =
  patterns.length === 0
    ? allFiles
    : allFiles.filter((f) => patterns.includes(basename(f)));

if (files.length === 0) {
  console.error(
    patterns.length > 0
      ? `No test files matched patterns: ${patterns.join(", ")}`
      : "No test files found matching tests/**/*.test.ts",
  );
  process.exit(1);
}

const result = spawnSync(
  "node",
  [...forwardedFlags, "--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);

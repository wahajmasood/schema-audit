// Discover all *.test.ts files under tests/ and run them via node:test + tsx.
// Kept dependency-free; works cross-platform without relying on shell globbing.
//
// Any --flag arguments to this script (e.g., --experimental-test-coverage)
// are forwarded to the inner `node --test` invocation so coverage and other
// node options apply to the same process that runs the tests.

import { glob } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const forwardedFlags = process.argv.slice(2).filter((a) => a.startsWith("--"));

const files = [];
for await (const file of glob("tests/**/*.test.ts")) {
  files.push(file);
}

if (files.length === 0) {
  console.error("No test files found matching tests/**/*.test.ts");
  process.exit(1);
}

const result = spawnSync(
  "node",
  [...forwardedFlags, "--import", "tsx", "--test", ...files],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);

// core/tests/conformance.test.ts
//
// Cycle 9 — cross-language parity assertion.
//
// Each `tests/conformance/<name>.input.json` is paired with the
// normalized expected output in `<name>.golden.json`. The Python suite
// asserts against the same goldens, so if these two runtimes ever
// diverge on a fixture, at least one CI will fail with a clear diff.
//
// To regenerate goldens (intentional behavior changes only):
//   node scripts/regen-conformance.mjs
// The script verifies JS + Python agree before writing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const CORPUS_DIR = resolve(REPO_ROOT, "tests", "conformance");

function deepSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = deepSort((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function normalize(result: unknown): unknown {
  const copy = JSON.parse(JSON.stringify(result));
  if (copy.registry && typeof copy.registry === "object") {
    copy.registry.snapshotAt = "<NORMALIZED>";
  }
  return deepSort(copy);
}

const inputs = readdirSync(CORPUS_DIR)
  .filter((f) => f.endsWith(".input.json"))
  .sort();

if (inputs.length === 0) {
  throw new Error(
    `No conformance fixtures found in ${CORPUS_DIR}. ` +
      "Did the repo skip the cycle-9 conformance corpus?",
  );
}

for (const file of inputs) {
  const name = basename(file, ".input.json");
  const inputPath = resolve(CORPUS_DIR, file);
  const goldenPath = inputPath.replace(/\.input\.json$/, ".golden.json");

  test(`conformance: ${name}`, () => {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    const goldenText = readFileSync(goldenPath, "utf8");
    const golden = JSON.parse(goldenText);

    const actual = normalize(validate(input));

    assert.deepEqual(
      actual,
      golden,
      `JS conformance drift on ${name}. ` +
        "Regenerate goldens with `node scripts/regen-conformance.mjs` " +
        "after confirming both implementations agree.",
    );
  });
}

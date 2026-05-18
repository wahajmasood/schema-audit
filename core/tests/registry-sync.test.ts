// core/tests/registry-sync.test.ts
//
// Cycle 9 — cross-language parity invariant.
//
// The Python package bundles its own copy of the schema-types and
// curated-rules JSON files at python/src/schema_audit/_data/ because
// pip-installed wheels can only see files inside the wheel. The single
// source of truth lives in core/registry/; scripts/build-registry.mjs
// writes both locations atomically.
//
// This test enforces the invariant: if anyone hand-edits one copy or
// regenerates one without re-running the build script, CI fails with a
// clear repair instruction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const JS_TYPES = resolve(REPO_ROOT, "core", "registry", "schema-types.json");
const JS_CURATED = resolve(REPO_ROOT, "core", "registry", "curated-rules.json");
const PY_TYPES = resolve(
  REPO_ROOT,
  "python",
  "src",
  "schema_audit",
  "_data",
  "schema-types.json",
);
const PY_CURATED = resolve(
  REPO_ROOT,
  "python",
  "src",
  "schema_audit",
  "_data",
  "curated-rules.json",
);

const REPAIR_HINT =
  "Repair: run `node scripts/build-registry.mjs` from the repo root to " +
  "rewrite both copies from the single source of truth (core/registry/).";

test("Python _data/ mirrors core/registry/ — schema-types.json", () => {
  assert.ok(
    existsSync(PY_TYPES),
    `Missing Python data file: ${PY_TYPES}\n${REPAIR_HINT}`,
  );
  const js = readFileSync(JS_TYPES, "utf8");
  const py = readFileSync(PY_TYPES, "utf8");
  assert.equal(
    py,
    js,
    `schema-types.json drifted between core/registry/ and ` +
      `python/src/schema_audit/_data/.\n${REPAIR_HINT}`,
  );
});

test("Python _data/ mirrors core/registry/ — curated-rules.json", () => {
  assert.ok(
    existsSync(PY_CURATED),
    `Missing Python data file: ${PY_CURATED}\n${REPAIR_HINT}`,
  );
  const js = readFileSync(JS_CURATED, "utf8");
  const py = readFileSync(PY_CURATED, "utf8");
  assert.equal(
    py,
    js,
    `curated-rules.json drifted between core/registry/ and ` +
      `python/src/schema_audit/_data/.\n${REPAIR_HINT}`,
  );
});

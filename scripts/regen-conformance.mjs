// scripts/regen-conformance.mjs
//
// Cycle 9 — regenerates the cross-language conformance corpus
// `tests/conformance/*.golden.json` from the JS validator, then runs
// the Python validator on the same inputs and aborts if the two
// outputs do not agree.
//
// Produces:
//   tests/conformance/<name>.golden.json   — normalized JS output
//
// Asserts (and exits 1 on failure):
//   normalize(jsValidate(input)) == normalize(pyValidate(input))
//
// "Normalization" replaces `registry.snapshotAt` (regenerates on every
// build) with the literal string "<NORMALIZED>". Everything else is
// asserted byte-for-byte under JSON.stringify(..., null, 2) +
// keys-deep-sorted form.
//
// Re-run this script when an intentional behavior change makes the
// existing goldens stale. If Python disagrees, the bug is in one of the
// two implementations — fix it, not the golden.
//
// Zero dependencies. Pure Node stdlib + spawn(python3).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../core/dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CORPUS_DIR = resolve(REPO_ROOT, "tests", "conformance");
const PY_SRC = resolve(REPO_ROOT, "python", "src");

// ─── 1. Deep-sort + normalize ──────────────────────────────────────

function deepSort(value) {
  if (Array.isArray(value)) {
    return value.map(deepSort);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = deepSort(value[key]);
    }
    return out;
  }
  return value;
}

function normalize(result) {
  // The snapshotAt timestamp regenerates on every build — pin it.
  const copy = JSON.parse(JSON.stringify(result));
  if (copy.registry && typeof copy.registry === "object") {
    copy.registry.snapshotAt = "<NORMALIZED>";
  }
  return deepSort(copy);
}

function serialize(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

// ─── 2. Python helper ──────────────────────────────────────────────

function pyValidate(inputJson) {
  const py = spawnSync(
    "python3",
    [
      "-c",
      `import json, sys
sys.path.insert(0, ${JSON.stringify(PY_SRC)})
from schema_audit import validate
input_value = json.loads(sys.stdin.read())
print(json.dumps(validate(input_value)))`,
    ],
    {
      input: inputJson,
      encoding: "utf8",
    },
  );
  if (py.status !== 0) {
    console.error("python3 failed:", py.stderr);
    process.exit(1);
  }
  return JSON.parse(py.stdout);
}

// ─── 3. Walk corpus ────────────────────────────────────────────────

const inputs = readdirSync(CORPUS_DIR)
  .filter((f) => f.endsWith(".input.json"))
  .sort();

if (inputs.length === 0) {
  console.error(`No .input.json files in ${CORPUS_DIR}`);
  process.exit(1);
}

let diverged = 0;
for (const file of inputs) {
  const inputPath = resolve(CORPUS_DIR, file);
  const goldenPath = inputPath.replace(/\.input\.json$/, ".golden.json");
  const name = basename(file, ".input.json");

  const rawText = readFileSync(inputPath, "utf8");
  const inputValue = JSON.parse(rawText);

  const jsOut = normalize(validate(inputValue));
  const pyOut = normalize(pyValidate(rawText));

  const jsSerialized = serialize(jsOut);
  const pySerialized = serialize(pyOut);

  if (jsSerialized !== pySerialized) {
    diverged++;
    console.error(`✗ ${name}: JS and Python disagree`);
    console.error("  JS:", jsSerialized.slice(0, 500));
    console.error("  PY:", pySerialized.slice(0, 500));
    continue;
  }

  writeFileSync(goldenPath, jsSerialized);
  console.log(`✓ ${name} (${jsOut.errors.length}E ${jsOut.warnings.length}W)`);
}

if (diverged > 0) {
  console.error(`\n${diverged} fixture(s) diverged. Goldens NOT updated.`);
  process.exit(1);
}

console.log(`\nWrote ${inputs.length} golden file(s) to ${CORPUS_DIR}.`);

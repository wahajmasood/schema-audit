// core/scripts/regen-corpus-snapshots.mjs
//
// Regenerates committed golden snapshots from the current dist/.
// Run via `npm run corpus:regen` (which builds first).
//
// Reads every JSON sample under core/tests/corpus/, calls validate()
// from the built artifact, normalizes the result (replacing
// non-deterministic registry version + timestamp fields with fixed
// placeholders), and writes `tests/corpus/snapshots/{slug}.snapshot.json`.
//
// Reports per-sample whether the snapshot changed and the total at the
// end. Idempotent: running twice in a row produces no diffs on the
// second run.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(__dirname, "..");
const CORPUS_DIR = resolve(CORE, "tests", "corpus");
const SNAPSHOT_DIR = resolve(CORPUS_DIR, "snapshots");

const NORMALIZED_SCHEMA_VERSION = "<NORMALIZED_SCHEMA_VERSION>";
const NORMALIZED_SNAPSHOT_AT = "<NORMALIZED_SNAPSHOT_AT>";
const NORMALIZED_CURATED_VERSION = "<NORMALIZED_CURATED_VERSION>";

function normalize(result) {
  return {
    ...result,
    registry: {
      schemaVersion: NORMALIZED_SCHEMA_VERSION,
      snapshotAt: NORMALIZED_SNAPSHOT_AT,
      curatedRulesVersion: NORMALIZED_CURATED_VERSION,
    },
  };
}

mkdirSync(SNAPSHOT_DIR, { recursive: true });

const samples = readdirSync(CORPUS_DIR)
  .filter((n) => n.endsWith(".json") || n.endsWith(".html"))
  .sort();

function slugOf(file) {
  return file.replace(/\.(?:json|html)$/, "");
}

let changed = 0;
let created = 0;

for (const file of samples) {
  const slug = slugOf(file);
  const inputPath = resolve(CORPUS_DIR, file);
  const snapshotPath = resolve(SNAPSHOT_DIR, `${slug}.snapshot.json`);

  const content = readFileSync(inputPath, "utf8");
  const result = validate(content);
  const normalized = normalize(result);
  const newContent = JSON.stringify(normalized, null, 2) + "\n";

  let oldContent = null;
  try {
    oldContent = readFileSync(snapshotPath, "utf8");
  } catch {
    /* first time */
  }

  if (oldContent === newContent) {
    console.log(`  ${slug.padEnd(40)} unchanged`);
  } else if (oldContent === null) {
    writeFileSync(snapshotPath, newContent);
    console.log(`  ${slug.padEnd(40)} CREATED`);
    created++;
  } else {
    writeFileSync(snapshotPath, newContent);
    console.log(`  ${slug.padEnd(40)} UPDATED`);
    changed++;
  }
}

console.log();
console.log(
  `${created} created, ${changed} updated, ${samples.length - created - changed} unchanged (of ${samples.length} samples)`,
);

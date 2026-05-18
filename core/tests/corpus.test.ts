// Cycle 4 — snapshot regression suite for the production-shaped corpus.
//
// For each JSON file under tests/corpus/, runs validate(), normalizes
// the non-deterministic registry fields, and compares against the
// committed snapshot. On mismatch, the test fails with a clear pointer
// to `npm run corpus:regen`.
//
// Snapshots normalize:
//   - registry.schemaVersion       → "<NORMALIZED_SCHEMA_VERSION>"
//   - registry.snapshotAt          → "<NORMALIZED_SNAPSHOT_AT>"
//   - registry.curatedRulesVersion → "<NORMALIZED_CURATED_VERSION>"
//
// so a registry rebuild (which changes those values) does NOT break
// the suite.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";
import type { ValidationResult } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = resolve(__dirname, "corpus");
const SNAPSHOT_DIR = resolve(CORPUS_DIR, "snapshots");

const NORMALIZED_SCHEMA_VERSION = "<NORMALIZED_SCHEMA_VERSION>";
const NORMALIZED_SNAPSHOT_AT = "<NORMALIZED_SNAPSHOT_AT>";
const NORMALIZED_CURATED_VERSION = "<NORMALIZED_CURATED_VERSION>";

function normalize(result: ValidationResult): unknown {
  return {
    ...result,
    registry: {
      schemaVersion: NORMALIZED_SCHEMA_VERSION,
      snapshotAt: NORMALIZED_SNAPSHOT_AT,
      curatedRulesVersion: NORMALIZED_CURATED_VERSION,
    },
  };
}

const samples = readdirSync(CORPUS_DIR)
  .filter((n) => n.endsWith(".json") || n.endsWith(".html"))
  .sort();

function slugOf(file: string): string {
  return file.replace(/\.(?:json|html)$/, "");
}

describe("corpus snapshot regression suite", () => {
  for (const file of samples) {
    const slug = slugOf(file);
    test(slug, () => {
      const inputPath = resolve(CORPUS_DIR, file);
      const snapshotPath = resolve(SNAPSHOT_DIR, `${slug}.snapshot.json`);

      const content = readFileSync(inputPath, "utf8");
      const actual = normalize(validate(content));

      let expected: unknown;
      try {
        expected = JSON.parse(readFileSync(snapshotPath, "utf8"));
      } catch {
        assert.fail(
          `Missing snapshot for "${slug}". Run 'npm run corpus:regen' to generate.`,
        );
      }

      assert.deepEqual(
        actual,
        expected,
        `Snapshot mismatch for "${slug}". If this change is intentional, run 'npm run corpus:regen' to update the snapshot.`,
      );
    });
  }
});

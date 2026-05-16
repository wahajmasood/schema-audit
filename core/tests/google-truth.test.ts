// Cycle 4 — Google Rich Results Test canary subset.
//
// Loads core/tests/google-truth.json, which is manually maintained by
// the project owner against Google's GUI-only Rich Results Test.
// For each canary entry, this test:
//
//   1. Asserts the entry has the right fields (well-formedness).
//   2. Checks freshness — entries older than STALE_DAYS get a
//      diagnostic (informational; does not fail).
//   3. Runs schema-audit's validator on the sample and maps its
//      output to the same vocabulary as `googleVerdict`. On
//      divergence, emits a diagnostic (informational; does not fail).
//
// Diagnostics surface in TAP output. The maintainer triages them
// during the weekly governance cadence.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";
import type { ValidationResult } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = resolve(__dirname, "corpus");
const GOOGLE_TRUTH = resolve(__dirname, "google-truth.json");

const STALE_DAYS = 60;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface CanaryEntry {
  slug: string;
  googleVerdict: string;
  notes: string;
  lastVerified: string;
}

interface GoogleTruth {
  canary: CanaryEntry[];
}

const truth = JSON.parse(readFileSync(GOOGLE_TRUTH, "utf8")) as GoogleTruth;

function ourVerdict(result: ValidationResult): string {
  if (result.errors.length > 0) return "not-eligible";
  const recommendedWarnings = result.warnings.filter(
    (w) => w.code === "MISSING_RECOMMENDED_PROPERTY",
  );
  return recommendedWarnings.length === 0
    ? "eligible-for-rich-result"
    : "eligible-with-warnings";
}

test("google-truth.json is well-formed", () => {
  assert.ok(Array.isArray(truth.canary), "canary must be an array");
  assert.ok(truth.canary.length > 0, "canary must be non-empty");
  for (const entry of truth.canary) {
    assert.equal(typeof entry.slug, "string", "slug missing/wrong type");
    assert.equal(
      typeof entry.googleVerdict,
      "string",
      "googleVerdict missing/wrong type",
    );
    assert.equal(typeof entry.notes, "string", "notes missing/wrong type");
    assert.equal(
      typeof entry.lastVerified,
      "string",
      "lastVerified missing/wrong type",
    );
  }
});

for (const entry of truth.canary) {
  test(`google-truth canary: ${entry.slug}`, (t) => {
    // Freshness check.
    const verifiedAt = new Date(entry.lastVerified);
    assert.equal(
      Number.isNaN(verifiedAt.getTime()),
      false,
      `lastVerified is not a valid date: ${entry.lastVerified}`,
    );
    const ageDays = (Date.now() - verifiedAt.getTime()) / MS_PER_DAY;
    if (ageDays > STALE_DAYS) {
      t.diagnostic(
        `STALE: "${entry.slug}" last verified ${entry.lastVerified} (>${STALE_DAYS} days ago)`,
      );
    }

    // Verdict check.
    const inputPath = resolve(CORPUS_DIR, `${entry.slug}.json`);
    let content: string;
    try {
      content = readFileSync(inputPath, "utf8");
    } catch {
      assert.fail(
        `Corpus sample missing for canary entry "${entry.slug}". Expected ${inputPath}.`,
      );
    }
    const result = validate(content);
    const ours = ourVerdict(result);

    if (ours !== entry.googleVerdict) {
      t.diagnostic(
        `DIVERGENCE: "${entry.slug}" — schema-audit=${ours}, google=${entry.googleVerdict}. ${entry.notes}`,
      );
    }

    // Info-only — the assertion is the well-formedness checks above.
    assert.ok(true);
  });
}

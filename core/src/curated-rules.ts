// core/src/curated-rules.ts
//
// Typed loader for the Layer-2 curated rules (Google Rich Results
// required + recommended-property checks).
//
// The JSON is bundled at build time (tsup/esbuild inlines it).
// Runtime does zero file I/O. Mirrors the schema-types registry
// loader.
//
// Per the constitution, this file is MANUALLY maintained from
// Google's Rich Results documentation — not auto-generated. See
// `core/registry/curated-rules.json` for the data and provenance.

import rawCuratedRules from "../registry/curated-rules.json";

/** Layer-2 rules for one schema.org type. */
export interface CuratedTypeRules {
  /** Simple required properties — each must be present. */
  required: string[];
  /**
   * "At least one of" groups — each sub-array must have at least one
   * member present for Rich Results eligibility. Empty array means no
   * such constraint.
   */
  requiredOneOf: string[][];
  /**
   * Recommended properties — each absent one emits a warning, not an
   * error.
   */
  recommended: string[];
}

/** The full curated-rules file shape. */
export interface CuratedRules {
  /** Documentation snapshot identifier (e.g., "google-rich-results-docs-YYYY-MM-DD"). */
  sourceVersion: string;
  /** ISO-8601 timestamp when the file was last edited. */
  snapshotAt: string;
  /** Map of type name → Layer-2 rules. */
  rules: Record<string, CuratedTypeRules>;
}

// scripts/build-registry.mjs does NOT produce this file. It is the
// only registry artifact maintained by hand.
const curatedRules = rawCuratedRules as CuratedRules;

/** Returns the loaded curated rules. Stable singleton. */
export function loadCuratedRules(): CuratedRules {
  return curatedRules;
}

/**
 * Looks up Layer-2 rules for a type. O(1).
 * Returns `undefined` for types not in the curated set (e.g., Person,
 * Organization, anything outside the cycle-3 cover). The validator
 * silently skips Layer 2 for those.
 */
export function getCuratedRules(
  typeName: string,
): CuratedTypeRules | undefined {
  return curatedRules.rules[typeName];
}

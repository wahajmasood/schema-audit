// core/src/rules/validate-context.ts
//
// Atomic rule: validates a JSON-LD object's @context.
//
// Rule contract (locked in spec-delta — Atomic-rule contracts):
//   validateContext(value: unknown, path: string): Issue[]
//
// Three outcomes:
//   - missing                       → MISSING_CONTEXT       (error)
//   - http://schema.org             → INSECURE_CONTEXT      (error)
//   - any non-schema.org https URL  → NONSTANDARD_CONTEXT   (warning)
//   - https://schema.org (any case) → no issue
//
// Pure function: no I/O, no shared state, no side effects.

import type { Issue } from "../types.js";
import {
  insecureContext,
  missingContext,
  nonstandardContext,
} from "../errors.js";

/**
 * Validates a JSON-LD `@context` value.
 *
 * Note: cycle 1 only handles `@context` as a string. Object and array
 * forms (`{"@context": {...}}` or `{"@context": ["..."]}`) are not yet
 * supported and will be added in a later cycle — they currently fall
 * through to NONSTANDARD_CONTEXT.
 */
export function validateContext(value: unknown): Issue[] {
  if (value === undefined || value === null) {
    return [missingContext()];
  }

  if (typeof value !== "string") {
    return [nonstandardContext(value)];
  }

  // http:// for schema.org specifically — that's the documented insecure case.
  if (/^http:\/\/(www\.)?schema\.org\b/i.test(value)) {
    return [insecureContext(value)];
  }

  // https://schema.org or https://www.schema.org → valid, no issue.
  if (/^https:\/\/(www\.)?schema\.org\b/i.test(value)) {
    return [];
  }

  // Anything else that's a string → nonstandard (warning).
  return [nonstandardContext(value)];
}

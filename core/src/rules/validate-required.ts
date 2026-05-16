// core/src/rules/validate-required.ts
//
// Layer 2 atomic rule: checks Google Rich Results required-property
// constraints. Two flavors:
//   - simple required:    every name in `required` must be present
//   - "at least one of":  for every group in `requiredOneOf`, at least
//                         one member must be present
//
// Pure function. No I/O. Returns Issue[] (possibly empty).
//
// "Present" means: the property key exists on the object AND its
// value is not undefined or null. (An empty string is considered
// present, matching how schema.org markup typically reads in the
// wild.)

import type { Issue } from "../types.js";
import {
  missingRequiredProperty,
  missingRequiredPropertyOneOf,
} from "../errors.js";

function isPresent(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  return v !== undefined && v !== null;
}

export function validateRequired(
  obj: Record<string, unknown>,
  typeName: string,
  required: string[],
  requiredOneOf: string[][],
): Issue[] {
  const issues: Issue[] = [];

  // Simple required: each missing one emits its own Issue.
  for (const propertyName of required) {
    if (!isPresent(obj, propertyName)) {
      issues.push(missingRequiredProperty(typeName, propertyName));
    }
  }

  // "At least one of": for each group, fail if no member is present.
  for (const alternatives of requiredOneOf) {
    if (alternatives.length === 0) continue;
    const anyPresent = alternatives.some((name) => isPresent(obj, name));
    if (!anyPresent) {
      issues.push(missingRequiredPropertyOneOf(typeName, alternatives));
    }
  }

  return issues;
}

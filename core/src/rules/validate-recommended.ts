// core/src/rules/validate-recommended.ts
//
// Layer 2 atomic rule: emits a warning for each recommended Google
// Rich Results property that's absent from the object.
//
// Pure function. No I/O. Warnings do not invalidate the result by
// default (only in strict mode).

import type { Issue } from "../types.js";
import { missingRecommendedProperty } from "../errors.js";

function isPresent(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  return v !== undefined && v !== null;
}

export function validateRecommended(
  obj: Record<string, unknown>,
  typeName: string,
  recommended: string[],
): Issue[] {
  const issues: Issue[] = [];
  for (const propertyName of recommended) {
    if (!isPresent(obj, propertyName)) {
      issues.push(missingRecommendedProperty(typeName, propertyName));
    }
  }
  return issues;
}

// core/src/rules/validate-url.ts
//
// Atomic rule: validates that a value is a parseable absolute URL.
//
// Uses Node's built-in `URL` constructor (zero deps). Throws → catch →
// INVALID_URL. We do NOT fetch the URL; we don't check whether it
// resolves. We only check structural parseability.
//
// Outcomes:
//   - non-string value         → INVALID_URL (error)
//   - string that won't parse  → INVALID_URL (error)
//   - parseable absolute URL   → no issue

import type { Issue } from "../types.js";
import { invalidUrl } from "../errors.js";

export function validateUrl(
  typeName: string,
  propertyName: string,
  value: unknown,
): Issue[] {
  if (typeof value !== "string") {
    return [invalidUrl(typeName, propertyName, value)];
  }
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return [];
  } catch {
    return [invalidUrl(typeName, propertyName, value)];
  }
}

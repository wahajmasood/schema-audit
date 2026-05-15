// core/src/rules/validate-type.ts
//
// Atomic rule: validates a JSON-LD object's @type.
//
// Outcomes:
//   - missing (undefined / null / empty)     → MISSING_TYPE  (error)
//   - non-string (number, array, object, …)  → UNKNOWN_TYPE  (error)
//   - string not in registry                 → UNKNOWN_TYPE  (error)
//   - string in registry                     → no issue
//
// Pure function: no I/O, no shared state, no side effects.
//
// Cycle 1 supports @type as a single string only. Multi-typed entities
// (@type: ["Article", "BlogPosting"]) are deferred to a later cycle.

import type { Issue } from "../types.js";
import type { Registry } from "../registry.js";
import { missingType, unknownType } from "../errors.js";

export function validateType(value: unknown, registry: Registry): Issue[] {
  if (value === undefined || value === null || value === "") {
    return [missingType()];
  }

  if (typeof value !== "string") {
    return [unknownType(value)];
  }

  if (registry.types[value] === undefined) {
    return [unknownType(value)];
  }

  return [];
}

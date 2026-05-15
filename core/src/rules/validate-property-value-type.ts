// core/src/rules/validate-property-value-type.ts
//
// Atomic rule: checks whether a property's value matches its expected
// schema.org value-types (per the registry's `valueTypes` array).
//
// Cycle 1 model — approximate, sufficient for Product Layer 1:
//   - JS string   → matches Text, URL, Date, DateTime, Time, or any
//                   non-primitive (object) type (schema.org allows
//                   object-typed properties to be referenced by URL).
//   - JS number   → matches Number or Integer.
//   - JS boolean  → matches Boolean.
//   - JS object   → matches any non-primitive type (deeper @type
//                   verification deferred to later cycle).
//   - JS array    → not supported in cycle 1; emits the mismatch.
//   - null        → returns empty (orchestrator decides whether
//                   missing-property is a separate concern).
//
// Returns Issue[] (possibly empty). Pure function.

import type { Issue } from "../types.js";
import { invalidPropertyValueType } from "../errors.js";

const SCHEMA_PRIMITIVES = new Set([
  "Text",
  "URL",
  "Number",
  "Integer",
  "Boolean",
  "Date",
  "DateTime",
  "Time",
]);

function isObjectType(typeName: string): boolean {
  return !SCHEMA_PRIMITIVES.has(typeName);
}

const STRING_PRIMITIVES = new Set(["Text", "URL", "Date", "DateTime", "Time"]);

export function validatePropertyValueType(
  typeName: string,
  propertyName: string,
  value: unknown,
  valueTypes: string[],
): Issue[] {
  if (value === null) {
    return [];
  }

  const fail = (): Issue[] => [
    invalidPropertyValueType(typeName, propertyName, valueTypes, value),
  ];

  if (typeof value === "string") {
    // String accepted by any string primitive or any non-primitive (URL ref).
    const ok = valueTypes.some(
      (t) => STRING_PRIMITIVES.has(t) || isObjectType(t),
    );
    return ok ? [] : fail();
  }

  if (typeof value === "number") {
    const ok = valueTypes.some((t) => t === "Number" || t === "Integer");
    return ok ? [] : fail();
  }

  if (typeof value === "boolean") {
    const ok = valueTypes.some((t) => t === "Boolean");
    return ok ? [] : fail();
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const ok = valueTypes.some((t) => isObjectType(t));
    return ok ? [] : fail();
  }

  // Arrays, functions, symbols, bigints — out of scope for cycle 1.
  return fail();
}

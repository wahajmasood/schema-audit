// core/src/rules/validate-property-existence.ts
//
// Atomic rule: checks whether a property is registered for a type
// (via the pre-flattened allProperties map, so inherited properties
// are covered without runtime parent-walking).
//
// Outcomes:
//   - type not in registry         → no issue (validateType reports it)
//   - property in allProperties    → no issue
//   - property not in allProperties → UNKNOWN_PROPERTY (error)

import type { Issue } from "../types.js";
import type { Registry } from "../registry.js";
import { unknownProperty } from "../errors.js";

export function validatePropertyExistence(
  typeName: string,
  propertyName: string,
  value: unknown,
  registry: Registry,
): Issue[] {
  const typeDef = registry.types[typeName];
  if (!typeDef) {
    // Type itself isn't registered — validateType handles that.
    return [];
  }
  if (typeDef.allProperties[propertyName] === undefined) {
    return [unknownProperty(typeName, propertyName, value)];
  }
  return [];
}

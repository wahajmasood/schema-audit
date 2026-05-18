// core/src/validators/per-item.ts
//
// Per-item validation logic — shared by the JSON-LD and Microdata
// orchestrators (and later, RDFa). Takes a JSON-LD-shaped object
// (parsed and known to be an object); runs Layer 1 (schema.org
// structural) + Layer 2 (Google Rich Results); returns Issue[].
//
// This file is the heart of the validator's per-item rules. The
// surrounding orchestrators handle format-specific concerns
// (parsing JSON, extracting Microdata) and then funnel each item
// through here.
//
// Pure: no I/O, no shared mutable state. The registry + curated
// rules are loaded once at module init.

import type { Issue } from "../types.js";
import { loadRegistry } from "../registry.js";
import { getCuratedRules } from "../curated-rules.js";
import { validateContext } from "../rules/validate-context.js";
import { validateType } from "../rules/validate-type.js";
import { validatePropertyExistence } from "../rules/validate-property-existence.js";
import { validatePropertyValueType } from "../rules/validate-property-value-type.js";
import { validateUrl } from "../rules/validate-url.js";
import { validateRequired } from "../rules/validate-required.js";
import { validateRecommended } from "../rules/validate-recommended.js";

const registry = loadRegistry();

// JSON-LD reserved keys (and Microdata's `@itemtypeRaw` diagnostic
// field, which never represents a real property).
const RESERVED_KEYS = new Set([
  "@context",
  "@type",
  "@id",
  "@graph",
  "@language",
  "@reverse",
  "@vocab",
  "@base",
  "@itemtypeRaw",
]);

const STRING_NON_URL_PRIMITIVES = new Set([
  "Text",
  "Date",
  "DateTime",
  "Time",
]);

function shouldValidateStringAsUrl(valueTypes: string[]): boolean {
  if (!valueTypes.includes("URL")) return false;
  for (const t of valueTypes) {
    if (STRING_NON_URL_PRIMITIVES.has(t)) return false;
  }
  return true;
}

export interface PerItemResult {
  issues: Issue[];
  /** The @type value if it resolved to a registered type, else null. */
  resolvedType: string | null;
}

/**
 * Validates a single JSON-LD-shaped item.
 *
 * @param o The parsed item object (already known to be a non-null,
 *          non-array object). Caller is responsible for parse-time
 *          handling and shape validation.
 * @returns issues found and the resolved type (or null when
 *          @type is missing/unknown).
 */
export function validateItem(o: Record<string, unknown>): PerItemResult {
  const issues: Issue[] = [];

  // Context
  issues.push(...validateContext(o["@context"]));

  // Type
  const typeValue = o["@type"];
  issues.push(...validateType(typeValue, registry));

  let resolvedType: string | null = null;
  if (
    typeof typeValue === "string" &&
    registry.types[typeValue] !== undefined
  ) {
    resolvedType = typeValue;
    const typeDef = registry.types[typeValue];

    // Properties
    for (const [key, val] of Object.entries(o)) {
      if (RESERVED_KEYS.has(key)) continue;

      const existence = validatePropertyExistence(
        typeValue,
        key,
        val,
        registry,
      );
      if (existence.length > 0) {
        issues.push(...existence);
        continue;
      }

      const propDef = typeDef.allProperties[key]!;
      issues.push(
        ...validatePropertyValueType(typeValue, key, val, propDef.valueTypes),
      );

      if (
        typeof val === "string" &&
        shouldValidateStringAsUrl(propDef.valueTypes)
      ) {
        issues.push(...validateUrl(typeValue, key, val));
      }
    }

    // Layer 2 — Google Rich Results
    const l2 = getCuratedRules(typeValue);
    if (l2 !== undefined) {
      issues.push(
        ...validateRequired(o, typeValue, l2.required, l2.requiredOneOf),
      );
      issues.push(...validateRecommended(o, typeValue, l2.recommended));
    }
  }

  return { issues, resolvedType };
}

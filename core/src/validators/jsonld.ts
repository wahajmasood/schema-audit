// core/src/validators/jsonld.ts
//
// JSON-LD validator orchestrator. Wires together the atomic rules and
// produces a ValidationResult per the locked output shape.
//
// Cycle 1 scope:
//   - Parse string input as JSON (PARSE_ERROR on malformed)
//   - Validate @context, @type
//   - For every non-`@`-prefixed property: existence + value-type checks
//   - URL-format check on string values where the registry says URL is allowed
//
// Strictly synchronous, in-memory, single pass over the document. Honors
// constitution Design Tenet #3 ("Synchronous, in-memory, single-pass").

import type {
  Issue,
  ValidationResult,
  ValidateOptions,
} from "../types.js";
import { loadRegistry } from "../registry.js";
import { parseError } from "../errors.js";
import { validateContext } from "../rules/validate-context.js";
import { validateType } from "../rules/validate-type.js";
import { validatePropertyExistence } from "../rules/validate-property-existence.js";
import { validatePropertyValueType } from "../rules/validate-property-value-type.js";
import { validateUrl } from "../rules/validate-url.js";

const registry = loadRegistry();

// JSON-LD reserved keys we skip during property iteration.
const RESERVED_KEYS = new Set([
  "@context",
  "@type",
  "@id",
  "@graph",
  "@language",
  "@reverse",
  "@vocab",
  "@base",
]);

// Non-URL string primitives. If any of these is among the allowed value-types,
// a string value could legitimately be one of them (not a URL), so we should
// NOT force URL validation. Only when URL is among the allowed types AND no
// non-URL string primitive is, do strings get URL-validated.
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

function bucket(issues: Issue[]): {
  errors: Issue[];
  warnings: Issue[];
  info: Issue[];
} {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const info: Issue[] = [];
  for (const issue of issues) {
    if (issue.type === "error") errors.push(issue);
    else if (issue.type === "warning") warnings.push(issue);
    else info.push(issue);
  }
  return { errors, warnings, info };
}

function emptyResult(
  errors: Issue[],
  warnings: Issue[] = [],
  info: Issue[] = [],
  types: string[] = [],
): ValidationResult {
  return {
    valid: errors.length === 0,
    format: "jsonld",
    types,
    errors,
    warnings,
    info,
    registry: {
      schemaVersion: registry.schemaVersion,
      snapshotAt: registry.snapshotAt,
    },
  };
}

export function validateJsonLd(
  input: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  // 1) Parse if string.
  let obj: unknown;
  if (typeof input === "string") {
    try {
      obj = JSON.parse(input);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return emptyResult([parseError(input, reason)]);
    }
  } else {
    obj = input;
  }

  // 2) Ensure it's an object (not array / primitive / null).
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return emptyResult([parseError(input, "Input is not a JSON object")]);
  }
  const o = obj as Record<string, unknown>;

  const issues: Issue[] = [];

  // 3) Context.
  issues.push(...validateContext(o["@context"]));

  // 4) Type.
  const typeValue = o["@type"];
  issues.push(...validateType(typeValue, registry));

  // 5) Properties — only if @type resolved to a registered type.
  const types: string[] = [];
  if (
    typeof typeValue === "string" &&
    registry.types[typeValue] !== undefined
  ) {
    types.push(typeValue);
    const typeDef = registry.types[typeValue];

    for (const [key, val] of Object.entries(o)) {
      if (RESERVED_KEYS.has(key)) continue;

      // 5a) Existence check.
      const existence = validatePropertyExistence(
        typeValue,
        key,
        val,
        registry,
      );
      if (existence.length > 0) {
        issues.push(...existence);
        continue; // unknown property — skip deeper checks
      }

      const propDef = typeDef.allProperties[key]!;

      // 5b) Value-type check.
      issues.push(
        ...validatePropertyValueType(
          typeValue,
          key,
          val,
          propDef.valueTypes,
        ),
      );

      // 5c) URL parseability check. Only triggers when a string MUST be a
      //     URL (i.e., URL is allowed AND no non-URL string primitive is).
      //     E.g., url/image trigger this; identifier (Text|URL|PropertyValue)
      //     does NOT, because "PROD-123" is a legitimate Text identifier.
      if (
        typeof val === "string" &&
        shouldValidateStringAsUrl(propDef.valueTypes)
      ) {
        issues.push(...validateUrl(typeValue, key, val));
      }
    }
  }

  // 6) Bucket + apply strict-mode flip.
  const { errors, warnings, info } = bucket(issues);
  const strictFail = options.strict === true && warnings.length > 0;

  return {
    valid: errors.length === 0 && !strictFail,
    format: "jsonld",
    types,
    errors,
    warnings,
    info,
    registry: {
      schemaVersion: registry.schemaVersion,
      snapshotAt: registry.snapshotAt,
    },
  };
}

// core/src/errors.ts
//
// Error code constants + Issue factories for every code emitted by cycle 1.
//
// Every code listed in spec-delta.md is registered here exactly once.
// Adding or renaming a code is a public-API change (major version bump
// per Design Tenet #5).
//
// Callers should NEVER construct Issues by hand — go through these
// factories so messages stay consistent and codes never drift.

import type { Issue, Severity } from "./types.js";

/**
 * The complete set of error codes emitted by cycle 1.
 * Locked as a public contract; only additions are allowed in future cycles.
 */
export const ErrorCode = {
  PARSE_ERROR: "PARSE_ERROR",
  UNKNOWN_FORMAT: "UNKNOWN_FORMAT",
  MISSING_CONTEXT: "MISSING_CONTEXT",
  INSECURE_CONTEXT: "INSECURE_CONTEXT",
  NONSTANDARD_CONTEXT: "NONSTANDARD_CONTEXT",
  MISSING_TYPE: "MISSING_TYPE",
  UNKNOWN_TYPE: "UNKNOWN_TYPE",
  UNKNOWN_PROPERTY: "UNKNOWN_PROPERTY",
  INVALID_PROPERTY_VALUE_TYPE: "INVALID_PROPERTY_VALUE_TYPE",
  INVALID_URL: "INVALID_URL",
  // Layer 2 — Google Rich Results (added in 0.3.0)
  MISSING_REQUIRED_PROPERTY: "MISSING_REQUIRED_PROPERTY",
  MISSING_RECOMMENDED_PROPERTY: "MISSING_RECOMMENDED_PROPERTY",
  // Microdata extraction (added in 0.5.0)
  NO_ITEMSCOPE: "NO_ITEMSCOPE",
  MISSING_ITEMTYPE: "MISSING_ITEMTYPE",
  INVALID_ITEMTYPE: "INVALID_ITEMTYPE",
} as const;

export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Internal helper: build an Issue with all 5 fields populated. */
function issue(
  type: Severity,
  code: ErrorCodeName,
  path: string,
  message: string,
  value: unknown,
): Issue {
  return { type, code, path, message, value };
}

// ─── Error factories — one per code listed in spec-delta.md ────────────────

export function parseError(input: unknown, reason: string): Issue {
  return issue(
    "error",
    ErrorCode.PARSE_ERROR,
    "",
    `Input is not valid JSON: ${reason}`,
    input,
  );
}

export function unknownFormat(value: unknown): Issue {
  return issue(
    "error",
    ErrorCode.UNKNOWN_FORMAT,
    "",
    "Could not auto-detect input format. Pass options.format explicitly.",
    value,
  );
}

export function missingContext(): Issue {
  return issue(
    "error",
    ErrorCode.MISSING_CONTEXT,
    "",
    "JSON-LD object is missing @context.",
    null,
  );
}

export function insecureContext(value: unknown): Issue {
  return issue(
    "error",
    ErrorCode.INSECURE_CONTEXT,
    "@context",
    "@context must use https://, not http://.",
    value,
  );
}

export function nonstandardContext(value: unknown): Issue {
  return issue(
    "warning",
    ErrorCode.NONSTANDARD_CONTEXT,
    "@context",
    "@context is not schema.org. Schema validation may be inaccurate.",
    value,
  );
}

export function missingType(): Issue {
  return issue(
    "error",
    ErrorCode.MISSING_TYPE,
    "",
    "JSON-LD object is missing @type.",
    null,
  );
}

export function unknownType(typeName: unknown): Issue {
  return issue(
    "error",
    ErrorCode.UNKNOWN_TYPE,
    "@type",
    `@type "${String(typeName)}" is not a recognized schema.org type.`,
    typeName,
  );
}

export function unknownProperty(
  typeName: string,
  propertyName: string,
  value: unknown,
): Issue {
  return issue(
    "error",
    ErrorCode.UNKNOWN_PROPERTY,
    `${typeName}.${propertyName}`,
    `Property "${propertyName}" is not defined on type ${typeName} or any of its ancestors.`,
    value,
  );
}

export function invalidPropertyValueType(
  typeName: string,
  propertyName: string,
  expected: string[],
  value: unknown,
): Issue {
  const actual = typeof value;
  return issue(
    "error",
    ErrorCode.INVALID_PROPERTY_VALUE_TYPE,
    `${typeName}.${propertyName}`,
    `Property "${propertyName}" on type ${typeName} expects one of [${expected.join(", ")}], got ${actual}.`,
    value,
  );
}

export function invalidUrl(
  typeName: string,
  propertyName: string,
  value: unknown,
): Issue {
  return issue(
    "error",
    ErrorCode.INVALID_URL,
    `${typeName}.${propertyName}`,
    `Property "${propertyName}" on type ${typeName} is not a valid URL.`,
    value,
  );
}

// ─── Layer 2 — Google Rich Results factories (added in 0.3.0) ──────────────

export function missingRequiredProperty(
  typeName: string,
  propertyName: string,
): Issue {
  return issue(
    "error",
    ErrorCode.MISSING_REQUIRED_PROPERTY,
    `${typeName}.${propertyName}`,
    `Required property "${propertyName}" is missing on type ${typeName} (Google Rich Results).`,
    null,
  );
}

export function missingRequiredPropertyOneOf(
  typeName: string,
  alternatives: string[],
): Issue {
  return issue(
    "error",
    ErrorCode.MISSING_REQUIRED_PROPERTY,
    typeName,
    `Type ${typeName} requires at least one of: [${alternatives.join(", ")}] (Google Rich Results).`,
    null,
  );
}

export function missingRecommendedProperty(
  typeName: string,
  propertyName: string,
): Issue {
  return issue(
    "warning",
    ErrorCode.MISSING_RECOMMENDED_PROPERTY,
    `${typeName}.${propertyName}`,
    `Recommended property "${propertyName}" is missing on type ${typeName} (Google Rich Results).`,
    null,
  );
}

// ─── Microdata extraction factories (added in 0.5.0) ───────────────────────

export function noItemscope(elementTag: string): Issue {
  return issue(
    "error",
    ErrorCode.NO_ITEMSCOPE,
    "",
    `<${elementTag}> has an "itemtype" attribute but is missing "itemscope". Microdata requires both on the same element.`,
    null,
  );
}

export function missingItemtype(): Issue {
  return issue(
    "error",
    ErrorCode.MISSING_ITEMTYPE,
    "",
    "Top-level [itemscope] element is missing an itemtype attribute. Microdata requires itemtype to identify the schema.org type.",
    null,
  );
}

export function invalidItemtype(value: unknown, reason: string): Issue {
  return issue(
    "error",
    ErrorCode.INVALID_ITEMTYPE,
    "",
    `Invalid itemtype: ${reason}`,
    value,
  );
}

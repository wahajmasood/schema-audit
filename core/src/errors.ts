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

// core/src/index.ts
//
// Public API surface for schema-audit.
//
// Locked output shape per Design Tenet #5. Adding fields is a minor
// version bump; changing meaning is a major.

import type { ValidationResult, ValidateOptions } from "./types.js";
import { validateJsonLd } from "./validators/jsonld.js";

// Re-export the public type contract.
export type {
  Format,
  Severity,
  Issue,
  ValidationResult,
  ValidateOptions,
} from "./types.js";

// Re-export the error-code identifiers (UPPER_SNAKE_CASE strings).
export { ErrorCode } from "./errors.js";
export type { ErrorCodeName } from "./errors.js";

/** Package version. */
export const VERSION = "0.2.0";

/**
 * Validates structured data against schema.org and Google Rich Results rules.
 *
 * Cycle 1 supports JSON-LD only. Microdata and RDFa land in later cycles.
 *
 * @example
 *   import { validate } from "schema-audit";
 *
 *   const result = validate({
 *     "@context": "https://schema.org",
 *     "@type": "Product",
 *     name: "Widget",
 *     url: "https://example.com/widget",
 *   });
 *
 *   if (!result.valid) {
 *     for (const err of result.errors) {
 *       console.error(err.code, err.path, err.message);
 *     }
 *   }
 */
export function validate(
  input: string | object,
  options?: ValidateOptions,
): ValidationResult {
  // Cycle 1: "auto" resolves to "jsonld". Microdata/RDFa detection
  // lands in later cycles, at which point detect() picks the format.
  return validateJsonLd(input, options);
}

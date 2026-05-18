// core/src/index.ts
//
// Public API surface for schema-audit.
//
// Locked output shape per Design Tenet #5. Adding fields is a minor
// version bump; changing meaning is a major.

import type { Format, ValidationResult, ValidateOptions } from "./types.js";
import { loadRegistry } from "./registry.js";
import { loadCuratedRules } from "./curated-rules.js";
import { unknownFormat } from "./errors.js";
import { validateJsonLd } from "./validators/jsonld.js";
import { validateMicrodata } from "./validators/microdata.js";
import { detect } from "./utils/detector.js";

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

// Format detection — public so callers can pre-classify.
export { detect } from "./utils/detector.js";

/** Package version. */
export const VERSION = "0.5.0";

const registry = loadRegistry();
const curatedRules = loadCuratedRules();

function unknownFormatResult(input: unknown, format: Format): ValidationResult {
  return {
    valid: false,
    format,
    types: [],
    errors: [unknownFormat(input)],
    warnings: [],
    info: [],
    registry: {
      schemaVersion: registry.schemaVersion,
      snapshotAt: registry.snapshotAt,
      curatedRulesVersion: curatedRules.sourceVersion,
    },
  };
}

/**
 * Validates structured data against schema.org and Google Rich Results
 * rules.
 *
 * Cycle 6 supports JSON-LD (string or parsed object) and Microdata
 * (HTML string). The format is auto-detected by default; pass
 * `options.format` to force a specific pipeline.
 *
 * @example
 *   import { validate } from "schema-audit";
 *
 *   // JSON-LD (object)
 *   validate({ "@context": "https://schema.org", "@type": "Product", ... });
 *
 *   // JSON-LD (string)
 *   validate('{"@context":"https://schema.org","@type":"Product",...}');
 *
 *   // Microdata
 *   validate('<div itemscope itemtype="https://schema.org/Product">...</div>');
 */
export function validate(
  input: string | object,
  options?: ValidateOptions,
): ValidationResult {
  const opts = options ?? {};
  const requested = opts.format ?? "auto";

  // Non-string input: always JSON-LD (Microdata requires HTML).
  if (typeof input !== "string") {
    if (requested === "microdata") {
      return unknownFormatResult(input, "microdata");
    }
    return validateJsonLd(input, opts);
  }

  // Resolve format from option or auto-detect.
  let resolved: Format;
  if (requested === "auto") {
    resolved = detect(input);
  } else {
    resolved = requested;
  }

  if (resolved === "jsonld") return validateJsonLd(input, opts);
  if (resolved === "microdata") return validateMicrodata(input, opts);

  // unknown / rdfa (cycle 7) / jsonld-embedded (future) — not yet handled
  return unknownFormatResult(input, resolved);
}

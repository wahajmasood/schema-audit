// core/src/types.ts
//
// Public type definitions for schema-audit.
// Locked as a public contract per Design Tenet #5:
//   Adding fields is a minor version bump.
//   Changing field meaning is a major version bump.
//   JS and Python emit the same shape, always.

/**
 * The format of the input being validated.
 * Cycle 1 emits only "jsonld"; later cycles add "microdata", "rdfa",
 * "jsonld-embedded". "unknown" is returned when auto-detection fails.
 */
export type Format =
  | "jsonld"
  | "microdata"
  | "rdfa"
  | "jsonld-embedded"
  | "unknown";

/** Severity of a validation issue. */
export type Severity = "error" | "warning" | "info";

/**
 * A single validation finding. Every Issue is debuggable from its fields
 * alone — `path` + `code` + `value` locate it precisely. No need to
 * re-print the input.
 */
export interface Issue {
  /** Severity tier; mirrors which bucket the issue lives in. */
  type: Severity;
  /** Stable UPPER_SNAKE_CASE code (e.g., "MISSING_REQUIRED_PROPERTY"). */
  code: string;
  /** Dotted path to the offending location (e.g., "Product.name", "@context", ""). */
  path: string;
  /** Human-readable English message. */
  message: string;
  /** The value that caused the issue, or null when no value applies. */
  value: unknown;
}

/**
 * The output of `validate()`. Identical shape across JS and Python (cycle 9+).
 */
export interface ValidationResult {
  /**
   * Overall verdict.
   *  - `true`  when `errors[]` is empty (and `warnings[]` is empty in strict mode)
   *  - `false` when any error is present
   */
  valid: boolean;
  /** Which format was validated. Cycle 1 only emits "jsonld". */
  format: Format;
  /** The schema.org types found in the input (declaration order). */
  types: string[];
  /** Errors that invalidate the markup. */
  errors: Issue[];
  /** Concerns that don't invalidate the markup (informational + recommendations). */
  warnings: Issue[];
  /** Notes about ambiguity or undetermined behavior (e.g., source is silent). */
  info: Issue[];
  /** Provenance: which registry snapshot rendered this verdict. */
  registry: {
    /** schema.org version (or placeholder during cycle 1). */
    schemaVersion: string;
    /** ISO-8601 timestamp when the registry was built. */
    snapshotAt: string;
    /**
     * The Layer-2 curated-rules snapshot version (Google Rich Results
     * docs). Added in 0.3.0 to make Layer-2 verdicts auditable.
     */
    curatedRulesVersion: string;
  };
}

/** Options to `validate()`. All fields optional with sensible defaults. */
export interface ValidateOptions {
  /**
   * The input format. "auto" detects from the input shape.
   * Cycle 1 supports only "jsonld" and "auto" (which resolves to "jsonld").
   */
  format?: "auto" | "jsonld";
  /**
   * When true, warnings flip `valid` to false. Useful for strict pipelines
   * that want to fail on anything less than perfect markup. Default: false.
   */
  strict?: boolean;
}

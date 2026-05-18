// core/src/validators/jsonld.ts
//
// JSON-LD validator orchestrator. Parses input, delegates per-item
// validation to per-item.ts. Returns a ValidationResult with
// format="jsonld" and the loaded registry's provenance fields.
//
// Strictly synchronous, in-memory, single pass over the document.
// Honors constitution Design Tenet #3.

import type {
  Issue,
  ValidationResult,
  ValidateOptions,
} from "../types.js";
import { loadRegistry } from "../registry.js";
import { loadCuratedRules } from "../curated-rules.js";
import { parseError } from "../errors.js";
import { validateItem } from "./per-item.js";

const registry = loadRegistry();
const curatedRules = loadCuratedRules();

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

function registryProvenance() {
  return {
    schemaVersion: registry.schemaVersion,
    snapshotAt: registry.snapshotAt,
    curatedRulesVersion: curatedRules.sourceVersion,
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
      return {
        valid: false,
        format: "jsonld",
        types: [],
        errors: [parseError(input, reason)],
        warnings: [],
        info: [],
        registry: registryProvenance(),
      };
    }
  } else {
    obj = input;
  }

  // 2) Ensure it's an object.
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return {
      valid: false,
      format: "jsonld",
      types: [],
      errors: [parseError(input, "Input is not a JSON object")],
      warnings: [],
      info: [],
      registry: registryProvenance(),
    };
  }

  // 3) Validate via the shared per-item engine.
  const { issues, resolvedType } = validateItem(
    obj as Record<string, unknown>,
  );

  // 4) Bucket + strict.
  const { errors, warnings, info } = bucket(issues);
  const strictFail = options.strict === true && warnings.length > 0;

  return {
    valid: errors.length === 0 && !strictFail,
    format: "jsonld",
    types: resolvedType ? [resolvedType] : [],
    errors,
    warnings,
    info,
    registry: registryProvenance(),
  };
}

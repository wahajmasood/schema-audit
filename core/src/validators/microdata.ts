// core/src/validators/microdata.ts
//
// Microdata validator orchestrator. Extracts items via parse5,
// delegates per-item validation to per-item.ts, aggregates issues
// across all top-level items, and returns one ValidationResult.
//
// When multiple top-level items of the same @type appear (e.g.,
// a list of Products), issue paths are prefixed with an index to
// disambiguate: Product[0].name, Product[1].name. When a type is
// unique, paths keep the cycle-1 shape (Product.name).
//
// Strictly synchronous; HTML parsing happens in-memory via parse5.

import type {
  Issue,
  ValidationResult,
  ValidateOptions,
} from "../types.js";
import { loadRegistry } from "../registry.js";
import { loadCuratedRules } from "../curated-rules.js";
import { extractMicrodata } from "../utils/microdata-extractor.js";
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

/** Rewrite an Issue's path by replacing `<typeName>` with `<prefix>`. */
function prefixPath(issue: Issue, typeName: string, prefix: string): Issue {
  let newPath = issue.path;
  if (issue.path === typeName) {
    newPath = prefix;
  } else if (issue.path.startsWith(`${typeName}.`)) {
    newPath = prefix + issue.path.slice(typeName.length);
  }
  if (newPath === issue.path) return issue;
  return { ...issue, path: newPath };
}

export function validateMicrodata(
  input: string,
  options: ValidateOptions = {},
): ValidationResult {
  const { items, extractionIssues } = extractMicrodata(input);

  // Count items per resolved type so we know whether to add index
  // prefixes for path disambiguation.
  const typeCounts = new Map<string, number>();
  for (const item of items) {
    const t = item["@type"];
    if (typeof t === "string") {
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
  }

  const allIssues: Issue[] = [...extractionIssues];
  const types: string[] = [];
  const typeIndex = new Map<string, number>();

  for (const item of items) {
    const { issues, resolvedType } = validateItem(
      item as Record<string, unknown>,
    );

    if (resolvedType !== null && (typeCounts.get(resolvedType) ?? 0) > 1) {
      const idx = typeIndex.get(resolvedType) ?? 0;
      typeIndex.set(resolvedType, idx + 1);
      const prefix = `${resolvedType}[${idx}]`;
      for (const issue of issues) {
        allIssues.push(prefixPath(issue, resolvedType, prefix));
      }
    } else {
      allIssues.push(...issues);
    }

    if (resolvedType !== null) types.push(resolvedType);
  }

  const { errors, warnings, info } = bucket(allIssues);
  const strictFail = options.strict === true && warnings.length > 0;

  return {
    valid: errors.length === 0 && !strictFail,
    format: "microdata",
    types,
    errors,
    warnings,
    info,
    registry: registryProvenance(),
  };
}

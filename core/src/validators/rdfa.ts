// core/src/validators/rdfa.ts
//
// RDFa validator orchestrator. Same shape as microdata.ts: runs the
// extractor, delegates per-item validation to per-item.ts, aggregates
// issues, applies multi-item path-prefix disambiguation, returns one
// ValidationResult with `format: "rdfa"`.

import type {
  Issue,
  ValidationResult,
  ValidateOptions,
} from "../types.js";
import { loadRegistry } from "../registry.js";
import { loadCuratedRules } from "../curated-rules.js";
import { extractRdfa } from "../utils/rdfa-extractor.js";
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

export function validateRdfa(
  input: string,
  options: ValidateOptions = {},
): ValidationResult {
  const { items, extractionIssues } = extractRdfa(input);

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
    format: "rdfa",
    types,
    errors,
    warnings,
    info,
    registry: registryProvenance(),
  };
}

// core/src/cli/render.ts
//
// Human-readable output for the schema-audit CLI. Pure function;
// takes a ValidationResult and returns a string. The CLI module
// writes the string to stdout.

import type { ValidationResult, Issue } from "../types.js";

export interface RenderOptions {
  /** Package version, surfaced in the provenance footer. */
  version: string;
}

export function renderHuman(
  result: ValidationResult,
  opts: RenderOptions,
): string {
  const lines: string[] = [];

  // Header line.
  if (result.types.length === 0 && result.errors.length === 0) {
    lines.push(`∅ No items found (format: ${result.format})`);
  } else {
    const typesLabel =
      result.types.length === 0 ? "(no items)" : result.types.join(", ");
    const mark = result.valid ? "✓" : "✗";
    const status = result.valid ? "valid" : "invalid";
    lines.push(`${mark} ${typesLabel} (${status})`);
  }

  // Issue summary.
  const errCount = result.errors.length;
  const warnCount = result.warnings.length;
  if (errCount > 0 || warnCount > 0) {
    const errPart = `${errCount} ${plural(errCount, "error", "errors")}`;
    const warnPart = `${warnCount} ${plural(warnCount, "warning", "warnings")}`;
    lines.push(`  ${errPart}, ${warnPart}:`);
    lines.push("");
    for (const issue of result.errors) {
      lines.push(...formatIssue(issue, "E"));
    }
    for (const issue of result.warnings) {
      lines.push(...formatIssue(issue, "W"));
    }
  } else if (result.types.length > 0) {
    lines.push("  No errors. No warnings.");
  }

  // Provenance footer.
  lines.push("");
  lines.push(
    `schema-audit v${opts.version} | format: ${result.format} | registry: ${result.registry.schemaVersion}`,
  );

  return lines.join("\n");
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function formatIssue(issue: Issue, marker: "E" | "W"): string[] {
  const pathPart = issue.path !== "" ? ` at ${issue.path}` : "";
  return [
    `  [${marker}] ${issue.code}${pathPart}`,
    `      ${issue.message}`,
    "",
  ];
}

"""Human-readable rendering of a :class:`ValidationResult` for the CLI.

Mirrors ``core/src/cli/render.ts`` 1:1 so the JS and Python CLIs produce
the same output for the same input.

Pure function — takes a result + the package version, returns a string.
"""

from __future__ import annotations

from .types import Issue, ValidationResult


def render_human(result: ValidationResult, *, version: str) -> str:
    lines: list[str] = []

    types = result["types"]
    errors = result["errors"]
    warnings = result["warnings"]

    # Header line.
    if not types and not errors:
        lines.append(f"∅ No items found (format: {result['format']})")
    else:
        types_label = ", ".join(types) if types else "(no items)"
        mark = "✓" if result["valid"] else "✗"
        status = "valid" if result["valid"] else "invalid"
        lines.append(f"{mark} {types_label} ({status})")

    # Issue summary.
    err_count = len(errors)
    warn_count = len(warnings)
    if err_count > 0 or warn_count > 0:
        err_part = f"{err_count} {_plural(err_count, 'error', 'errors')}"
        warn_part = f"{warn_count} {_plural(warn_count, 'warning', 'warnings')}"
        lines.append(f"  {err_part}, {warn_part}:")
        lines.append("")
        for issue in errors:
            lines.extend(_format_issue(issue, "E"))
        for issue in warnings:
            lines.extend(_format_issue(issue, "W"))
    elif types:
        lines.append("  No errors. No warnings.")

    # Provenance footer.
    lines.append("")
    lines.append(
        f"schema-audit v{version} | format: {result['format']} | "
        f"registry: {result['registry']['schemaVersion']}"
    )

    return "\n".join(lines)


def _plural(n: int, one: str, many: str) -> str:
    return one if n == 1 else many


def _format_issue(issue: Issue, marker: str) -> list[str]:
    path = issue["path"]
    path_part = f" at {path}" if path else ""
    return [
        f"  [{marker}] {issue['code']}{path_part}",
        f"      {issue['message']}",
        "",
    ]

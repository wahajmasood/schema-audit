"""RDFa orchestrator.

Ports ``core/src/validators/rdfa.ts``. Same per-item engine and same
multi-item path-prefix logic as the Microdata orchestrator.
"""

from __future__ import annotations

from .._per_item import validate_item
from .._rdfa_extractor import extract_rdfa
from ..curated_rules import load_curated_rules
from ..registry import load_registry
from ..types import Issue, RegistryInfo, ValidationResult

_REGISTRY = load_registry()
_CURATED = load_curated_rules()


def _registry_provenance() -> RegistryInfo:
    return {
        "schemaVersion": _REGISTRY["schemaVersion"],
        "snapshotAt": _REGISTRY["snapshotAt"],
        "curatedRulesVersion": _CURATED["sourceVersion"],
    }


def _bucket(issues: list[Issue]) -> tuple[list[Issue], list[Issue], list[Issue]]:
    errors: list[Issue] = []
    warnings: list[Issue] = []
    info: list[Issue] = []
    for issue in issues:
        severity = issue["type"]
        if severity == "error":
            errors.append(issue)
        elif severity == "warning":
            warnings.append(issue)
        else:
            info.append(issue)
    return errors, warnings, info


def _prefix_path(issue: Issue, type_name: str, prefix: str) -> Issue:
    path = issue["path"]
    if path == type_name:
        new_path = prefix
    elif path.startswith(f"{type_name}."):
        new_path = prefix + path[len(type_name) :]
    else:
        return issue
    return {
        "type": issue["type"],
        "code": issue["code"],
        "path": new_path,
        "message": issue["message"],
        "value": issue["value"],
    }


def validate_rdfa(html: str, *, strict: bool = False) -> ValidationResult:
    items, extraction_issues = extract_rdfa(html)

    type_counts: dict[str, int] = {}
    for item in items:
        t = item.get("@type")
        if isinstance(t, str):
            type_counts[t] = type_counts.get(t, 0) + 1

    all_issues: list[Issue] = list(extraction_issues)
    types_out: list[str] = []
    type_index: dict[str, int] = {}

    for item in items:
        result = validate_item(item)

        if result.resolved_type is not None and type_counts.get(result.resolved_type, 0) > 1:
            idx = type_index.get(result.resolved_type, 0)
            type_index[result.resolved_type] = idx + 1
            prefix = f"{result.resolved_type}[{idx}]"
            for issue in result.issues:
                all_issues.append(_prefix_path(issue, result.resolved_type, prefix))
        else:
            all_issues.extend(result.issues)

        if result.resolved_type is not None:
            types_out.append(result.resolved_type)

    errors, warnings, info = _bucket(all_issues)
    strict_fail = strict and len(warnings) > 0

    return {
        "valid": len(errors) == 0 and not strict_fail,
        "format": "rdfa",
        "types": types_out,
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "registry": _registry_provenance(),
    }

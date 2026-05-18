"""JSON-LD orchestrator.

Parses input (if string), routes the parsed object through the shared
per-item engine, buckets issues by severity, applies ``strict``, and
returns a fully-populated :class:`schema_audit.types.ValidationResult`.

Strictly synchronous, single-pass, no I/O. Mirrors
``core/src/validators/jsonld.ts``.
"""

from __future__ import annotations

import json
from json import JSONDecodeError

from .._per_item import validate_item
from ..curated_rules import load_curated_rules
from ..errors import parse_error
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


def _parse_error_result(original_input: object, reason: str) -> ValidationResult:
    return {
        "valid": False,
        "format": "jsonld",
        "types": [],
        "errors": [parse_error(original_input, reason)],
        "warnings": [],
        "info": [],
        "registry": _registry_provenance(),
    }


def validate_jsonld(input_value: object, *, strict: bool = False) -> ValidationResult:
    """Validate JSON-LD input (string, dict, or list).

    The behavior matches the JS orchestrator exactly:

    - string input is JSON-parsed; ``JSONDecodeError`` → ``PARSE_ERROR``
    - top-level list / None / non-dict → ``PARSE_ERROR``
    - dict input → routed through the per-item engine
    """
    # 1. Parse if string.
    obj: object
    if isinstance(input_value, str):
        try:
            obj = json.loads(input_value)
        except JSONDecodeError as err:
            return _parse_error_result(input_value, str(err))
    else:
        obj = input_value

    # 2. Top-level shape must be a dict.
    if not isinstance(obj, dict):
        return _parse_error_result(input_value, "Input is not a JSON object")

    # 3. Validate via shared per-item engine.
    result = validate_item(obj)

    # 4. Bucket + strict.
    errors, warnings, info = _bucket(result.issues)
    strict_fail = strict and len(warnings) > 0

    return {
        "valid": len(errors) == 0 and not strict_fail,
        "format": "jsonld",
        "types": [result.resolved_type] if result.resolved_type else [],
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "registry": _registry_provenance(),
    }

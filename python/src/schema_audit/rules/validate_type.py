"""Atomic rule: validate a JSON-LD ``@type`` value.

Mirrors ``core/src/rules/validate-type.ts`` 1:1.

Outcomes:

- missing (None / empty string)            → ``MISSING_TYPE`` (error)
- non-string (number, list, dict, …)       → ``UNKNOWN_TYPE`` (error)
- string not in registry                   → ``UNKNOWN_TYPE`` (error)
- string in registry                       → no issue

Cycle 9 supports ``@type`` as a single string only. Multi-typed
entities (``@type: ["Article", "BlogPosting"]``) are handled by the
orchestrator before this rule sees the value.
"""

from __future__ import annotations

from ..errors import missing_type, unknown_type
from ..registry import Registry
from ..types import Issue


def validate_type(value: object, registry: Registry) -> list[Issue]:
    if value is None or value == "":
        return [missing_type()]

    if not isinstance(value, str):
        return [unknown_type(value)]

    if value not in registry["types"]:
        return [unknown_type(value)]

    return []

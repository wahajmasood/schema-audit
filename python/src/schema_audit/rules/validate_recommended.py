"""Layer 2 atomic rule: emit a warning for each recommended Google Rich
Results property that's absent from the object.

Mirrors ``core/src/rules/validate-recommended.ts`` 1:1. Warnings do not
invalidate the result by default (only in strict mode, which the
orchestrator applies after the fact).
"""

from __future__ import annotations

from ..errors import missing_recommended_property
from ..types import Issue


def _is_present(obj: dict[str, object], key: str) -> bool:
    return key in obj and obj[key] is not None


def validate_recommended(
    obj: dict[str, object],
    type_name: str,
    recommended: list[str],
) -> list[Issue]:
    issues: list[Issue] = []
    for property_name in recommended:
        if not _is_present(obj, property_name):
            issues.append(missing_recommended_property(type_name, property_name))
    return issues

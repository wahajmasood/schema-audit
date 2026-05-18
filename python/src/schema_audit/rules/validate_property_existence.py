"""Atomic rule: check whether a property is registered for a type.

Mirrors ``core/src/rules/validate-property-existence.ts`` 1:1.

Outcomes:

- type not in registry         → no issue (``validate_type`` reports it)
- property in ``allProperties`` → no issue
- property not in ``allProperties`` → ``UNKNOWN_PROPERTY`` (error)

Uses the pre-flattened ``allProperties`` map (built at registry-build
time) so inherited properties are covered without runtime
parent-walking.
"""

from __future__ import annotations

from ..errors import unknown_property
from ..registry import Registry
from ..types import Issue


def validate_property_existence(
    type_name: str,
    property_name: str,
    value: object,
    registry: Registry,
) -> list[Issue]:
    type_def = registry["types"].get(type_name)
    if type_def is None:
        # Type itself isn't registered — validate_type handles that.
        return []
    if property_name not in type_def["allProperties"]:
        return [unknown_property(type_name, property_name, value)]
    return []

"""Layer 2 atomic rule: Google Rich Results required-property constraints.

Mirrors ``core/src/rules/validate-required.ts`` 1:1. Two flavors:

- **simple required**: every name in ``required`` must be present
- **"at least one of"**: for every group in ``requiredOneOf``, at least
  one member must be present

"Present" means the property key exists on the dict AND its value is
not ``None``. (An empty string is considered present, matching how
schema.org markup typically reads in the wild.)
"""

from __future__ import annotations

from ..errors import missing_required_property, missing_required_property_one_of
from ..types import Issue


def _is_present(obj: dict[str, object], key: str) -> bool:
    return key in obj and obj[key] is not None


def validate_required(
    obj: dict[str, object],
    type_name: str,
    required: list[str],
    required_one_of: list[list[str]],
) -> list[Issue]:
    issues: list[Issue] = []

    for property_name in required:
        if not _is_present(obj, property_name):
            issues.append(missing_required_property(type_name, property_name))

    for alternatives in required_one_of:
        if not alternatives:
            continue
        if not any(_is_present(obj, name) for name in alternatives):
            issues.append(missing_required_property_one_of(type_name, alternatives))

    return issues

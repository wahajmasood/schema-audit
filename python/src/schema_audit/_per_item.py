"""Per-item validation logic — shared across format orchestrators.

Cycle 9 has only one orchestrator (JSON-LD), but the per-item engine is
extracted now so cycle 10's Microdata + RDFa orchestrators can plug in
cleanly — exactly as the JS side did in cycle 6.

Pure: no I/O, no shared mutable state. The registry + curated rules are
loaded once at module import.

Mirrors ``core/src/validators/per-item.ts`` 1:1.
"""

from __future__ import annotations

from typing import NamedTuple

from .curated_rules import get_curated_rules
from .registry import load_registry
from .rules.validate_context import validate_context
from .rules.validate_property_existence import validate_property_existence
from .rules.validate_property_value_type import validate_property_value_type
from .rules.validate_recommended import validate_recommended
from .rules.validate_required import validate_required
from .rules.validate_type import validate_type
from .rules.validate_url import validate_url
from .types import Issue

_REGISTRY = load_registry()

# JSON-LD reserved keys (and the Microdata diagnostic field reserved for
# cycle 10) — never validated as schema.org properties.
_RESERVED_KEYS = frozenset(
    {
        "@context",
        "@type",
        "@id",
        "@graph",
        "@language",
        "@reverse",
        "@vocab",
        "@base",
        "@itemtypeRaw",
    }
)

_STRING_NON_URL_PRIMITIVES = frozenset({"Text", "Date", "DateTime", "Time"})


def _should_validate_string_as_url(value_types: list[str]) -> bool:
    if "URL" not in value_types:
        return False
    return not any(t in _STRING_NON_URL_PRIMITIVES for t in value_types)


class PerItemResult(NamedTuple):
    issues: list[Issue]
    resolved_type: str | None


def validate_item(obj: dict[str, object]) -> PerItemResult:
    """Validate a single JSON-LD-shaped item.

    The caller is responsible for parse-time handling and asserting the
    input is a non-null, non-list dict.
    """
    issues: list[Issue] = []

    # 1. @context
    issues.extend(validate_context(obj.get("@context")))

    # 2. @type
    type_value = obj.get("@type")
    issues.extend(validate_type(type_value, _REGISTRY))

    resolved_type: str | None = None
    if isinstance(type_value, str) and type_value in _REGISTRY["types"]:
        resolved_type = type_value
        type_def = _REGISTRY["types"][type_value]

        # 3. Properties
        for key, val in obj.items():
            if key in _RESERVED_KEYS:
                continue

            existence = validate_property_existence(type_value, key, val, _REGISTRY)
            if existence:
                issues.extend(existence)
                continue

            prop_def = type_def["allProperties"][key]
            value_types = prop_def["valueTypes"]
            issues.extend(
                validate_property_value_type(type_value, key, val, value_types)
            )

            if isinstance(val, str) and _should_validate_string_as_url(value_types):
                issues.extend(validate_url(type_value, key, val))

        # 4. Layer 2 — Google Rich Results
        l2 = get_curated_rules(type_value)
        if l2 is not None:
            issues.extend(
                validate_required(obj, type_value, l2["required"], l2["requiredOneOf"])
            )
            issues.extend(validate_recommended(obj, type_value, l2["recommended"]))

    return PerItemResult(issues=issues, resolved_type=resolved_type)

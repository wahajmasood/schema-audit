"""Atomic rule: check a property's value against its expected
schema.org value-types.

Mirrors ``core/src/rules/validate-property-value-type.ts`` 1:1.

Cycle 9 model (approximate, sufficient for the curated coverage):

- Python ``str``     → matches ``Text``, ``URL``, ``Date``, ``DateTime``,
  ``Time``, or any non-primitive (object) type — schema.org allows
  object-typed properties to be referenced by URL.
- Python ``int``/``float`` (but NOT ``bool``) → matches ``Number`` or
  ``Integer``.
- Python ``bool``    → matches ``Boolean``.
- Python ``dict``    → matches any non-primitive type (deeper ``@type``
  verification deferred).
- Python ``list``    → not supported in cycle 9; emits the mismatch.
- ``None``           → returns empty (the orchestrator decides whether a
  missing property is a separate concern).
"""

from __future__ import annotations

from ..errors import invalid_property_value_type
from ..types import Issue

_SCHEMA_PRIMITIVES = frozenset(
    {"Text", "URL", "Number", "Integer", "Boolean", "Date", "DateTime", "Time"}
)
_STRING_PRIMITIVES = frozenset({"Text", "URL", "Date", "DateTime", "Time"})


def _is_object_type(type_name: str) -> bool:
    return type_name not in _SCHEMA_PRIMITIVES


def validate_property_value_type(
    type_name: str,
    property_name: str,
    value: object,
    value_types: list[str],
) -> list[Issue]:
    if value is None:
        return []

    def fail() -> list[Issue]:
        return [invalid_property_value_type(type_name, property_name, value_types, value)]

    # `bool` is a subclass of `int` in Python — check it first.
    if isinstance(value, bool):
        ok = any(t == "Boolean" for t in value_types)
        return [] if ok else fail()

    if isinstance(value, str):
        ok = any(t in _STRING_PRIMITIVES or _is_object_type(t) for t in value_types)
        return [] if ok else fail()

    if isinstance(value, int | float):
        ok = any(t in ("Number", "Integer") for t in value_types)
        return [] if ok else fail()

    if isinstance(value, dict):
        ok = any(_is_object_type(t) for t in value_types)
        return [] if ok else fail()

    # Lists, anything else — out of scope (orchestrator may handle list-fan-out).
    return fail()

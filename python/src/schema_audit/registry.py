"""Typed loader for the pre-flattened schema-types registry.

The registry JSON is loaded once at module-import time via
``importlib.resources`` from the package's bundled ``_data/`` directory.
Validation never re-reads it. Validation also never walks parent chains:
the JSON was pre-flattened at build time by
``scripts/build-registry.mjs`` per the constitution's Design Tenet #4
("Pre-index, don't recurse").

This mirrors ``core/src/registry.ts`` 1:1 — same shape, same API names
(snake_case'd), same singleton semantics.
"""

from __future__ import annotations

import json
from importlib.resources import files
from typing import TypedDict, cast


class PropertyDef(TypedDict):
    """A schema.org property definition. Mirrors the registry JSON shape."""

    valueTypes: list[str]
    definedOn: str


class TypeDef(TypedDict):
    """A type's pre-flattened registry entry."""

    parents: list[str]
    allProperties: dict[str, PropertyDef]
    ownProperties: list[str]


class Registry(TypedDict):
    """The full registry shape."""

    schemaVersion: str
    snapshotAt: str
    types: dict[str, TypeDef]


def _load() -> Registry:
    """Load and cache the registry JSON from packaged data."""
    raw = (
        files("schema_audit._data")
        .joinpath("schema-types.json")
        .read_text(encoding="utf-8")
    )
    return cast(Registry, json.loads(raw))


_REGISTRY: Registry = _load()


def load_registry() -> Registry:
    """Returns the loaded registry. Always the same reference — no re-read."""
    return _REGISTRY


def get_type_def(name: str) -> TypeDef | None:
    """Looks up a type definition by name. O(1).

    Returns ``None`` when the type isn't in the registry.
    """
    return _REGISTRY["types"].get(name)

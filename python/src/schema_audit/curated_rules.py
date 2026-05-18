"""Typed loader for Layer-2 curated rules (Google Rich Results).

The JSON is loaded once at module-import time. Validation never re-reads
it. Mirrors ``core/src/curated-rules.ts`` 1:1.

Per the constitution, this file is hand-maintained from Google's Rich
Results documentation — not auto-generated. See
``core/registry/curated-rules.json`` for the data and provenance.
"""

from __future__ import annotations

import json
from importlib.resources import files
from typing import TypedDict, cast


class CuratedTypeRules(TypedDict):
    """Layer-2 rules for one schema.org type."""

    required: list[str]
    requiredOneOf: list[list[str]]
    recommended: list[str]


class CuratedRules(TypedDict):
    """The full curated-rules file shape."""

    sourceVersion: str
    snapshotAt: str
    rules: dict[str, CuratedTypeRules]


def _load() -> CuratedRules:
    raw = (
        files("schema_audit._data")
        .joinpath("curated-rules.json")
        .read_text(encoding="utf-8")
    )
    return cast(CuratedRules, json.loads(raw))


_RULES: CuratedRules = _load()


def load_curated_rules() -> CuratedRules:
    """Returns the loaded curated rules. Stable singleton."""
    return _RULES


def get_curated_rules(type_name: str) -> CuratedTypeRules | None:
    """Looks up Layer-2 rules for a type. O(1).

    Returns ``None`` for types not in the curated set (e.g., Person,
    Organization). The validator silently skips Layer 2 for those.
    """
    return _RULES["rules"].get(type_name)

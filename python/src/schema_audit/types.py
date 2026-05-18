"""Public type definitions for schema-audit.

Locked as a public contract per the constitution's Design Tenet #5:
- Adding fields is a minor version bump.
- Changing field meaning is a major version bump.
- JS and Python emit the same shape, always.

We use ``TypedDict`` so that ``ValidationResult`` is, at runtime, a plain
``dict`` with the same shape that ``JSON.stringify`` produces in
JavaScript — byte-identical when serialized with
``json.dumps(result, sort_keys=True)``. No ``dataclasses.asdict`` step,
no converter, no opportunity for shape drift.
"""

from __future__ import annotations

from typing import Literal, TypedDict

# ── Literals ────────────────────────────────────────────────────────────────

Format = Literal["jsonld", "microdata", "rdfa", "jsonld-embedded", "unknown"]
"""The format of the input being validated.

Cycle 9 (Python) validates only ``"jsonld"``. ``"microdata"`` and
``"rdfa"`` are detected but produce an ``UNSUPPORTED_FORMAT`` result
until cycle 10. ``"jsonld-embedded"`` (``<script type=\"application/ld+json\">``
inside HTML) is reserved for a later cycle. ``"unknown"`` means
auto-detection failed.
"""

Severity = Literal["error", "warning", "info"]
"""Severity of a validation issue."""


# ── Issue ───────────────────────────────────────────────────────────────────


class Issue(TypedDict):
    """A single validation finding.

    Every Issue is fully debuggable from its fields alone: ``path`` +
    ``code`` + ``value`` locate it precisely without re-printing the input.
    """

    type: Severity
    code: str
    path: str
    message: str
    value: object  # JS uses `unknown`; Python's structural analogue is `object`


# ── ValidationResult ────────────────────────────────────────────────────────


class RegistryInfo(TypedDict):
    """Provenance: which registry snapshot rendered this verdict."""

    schemaVersion: str
    snapshotAt: str
    curatedRulesVersion: str


class ValidationResult(TypedDict):
    """The return shape of :func:`schema_audit.validate`.

    Identical across JS and Python (constitution Principle #2).
    """

    valid: bool
    format: Format
    types: list[str]
    errors: list[Issue]
    warnings: list[Issue]
    info: list[Issue]
    registry: RegistryInfo

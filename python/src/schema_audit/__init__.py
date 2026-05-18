"""schema-audit — programmatic schema-markup validation engine.

Public API (cycle 9 / v0.8.0):
- :func:`validate` — main entry point
- :func:`detect` — format detection
- :data:`VERSION` / ``__version__`` — package version (kept in lockstep with
  the JavaScript package — see ``core/src/index.ts``)
- :class:`ErrorCode` — string constants for every issue ``code`` we emit
- Public TypedDict types: :class:`Issue`, :class:`ValidationResult`,
  :class:`Format`, :class:`Severity`

Validation is a pure function of input plus the bundled registry. No
network, no subprocesses, no globals. Output shape is byte-identical to
the JavaScript package (constitution Principle #2).
"""

from __future__ import annotations

from typing import cast

from ._detector import detect
from .curated_rules import load_curated_rules
from .errors import ErrorCode, unsupported_format
from .registry import load_registry
from .types import Format, Issue, RegistryInfo, Severity, ValidationResult
from .validators.jsonld import validate_jsonld

VERSION = "0.8.0"
__version__ = VERSION

__all__ = [
    "VERSION",
    "ErrorCode",
    "Format",
    "Issue",
    "RegistryInfo",
    "Severity",
    "ValidationResult",
    "__version__",
    "detect",
    "validate",
]

_REGISTRY = load_registry()
_CURATED = load_curated_rules()


def _registry_provenance() -> RegistryInfo:
    return {
        "schemaVersion": _REGISTRY["schemaVersion"],
        "snapshotAt": _REGISTRY["snapshotAt"],
        "curatedRulesVersion": _CURATED["sourceVersion"],
    }


def _unsupported_format_result(requested: Format) -> ValidationResult:
    """Build a structured result for ``microdata`` / ``rdfa`` (cycle 9 only).

    The Python package will validate these formats natively in cycle 10.
    Until then we emit a well-formed result whose ``errors`` array
    surfaces the limitation — callers do not have to special-case nulls.
    """
    return {
        "valid": False,
        "format": requested,
        "types": [],
        "errors": [unsupported_format(requested)],
        "warnings": [],
        "info": [],
        "registry": _registry_provenance(),
    }


def validate(
    input_value: str | dict[str, object],
    *,
    format: Format | str = "auto",
    strict: bool = False,
) -> ValidationResult:
    """Validate structured data against schema.org + Google Rich Results.

    :param input_value: JSON-LD as either a raw JSON string or an
        already-parsed ``dict``. ``list`` and other types are routed
        through the parser (which will return a ``PARSE_ERROR`` result),
        matching the JavaScript package's behavior exactly.
    :param format: ``"auto"`` (default) auto-detects from the input
        shape; ``"jsonld"`` forces the JSON-LD pipeline. Passing
        ``"microdata"`` or ``"rdfa"`` returns an
        ``UNSUPPORTED_FORMAT`` result in v0.8.0 — full Python parity
        ships in the next release.
    :param strict: when True, warnings flip ``valid`` to ``False``.
    :returns: a :class:`ValidationResult` dict with the same shape the
        JS package emits.

    Examples::

        from schema_audit import validate

        # dict input
        validate({"@context": "https://schema.org", "@type": "Product", ...})

        # JSON string input
        validate('{"@context":"https://schema.org","@type":"Product"}')

        # Force a format (skip detection)
        validate(html_string, format="microdata")  # → UNSUPPORTED_FORMAT result
    """
    requested = format or "auto"

    # Non-string inputs — Microdata / RDFa cannot be a Python dict, so
    # they always go through the JSON-LD path unless explicitly forced.
    if not isinstance(input_value, str):
        if requested == "microdata" or requested == "rdfa":
            return _unsupported_format_result(cast(Format, requested))
        return validate_jsonld(input_value, strict=strict)

    # Resolve format from option or auto-detect.
    resolved: Format
    if requested == "auto":
        resolved = detect(input_value)
    else:
        # Caller asked for an explicit format. Trust it.
        resolved = cast(Format, requested)

    if resolved == "jsonld":
        return validate_jsonld(input_value, strict=strict)

    if resolved in ("microdata", "rdfa"):
        return _unsupported_format_result(resolved)

    # "unknown" or any future format we don't yet handle.
    from .errors import unknown_format

    return {
        "valid": False,
        "format": resolved,
        "types": [],
        "errors": [unknown_format(input_value)],
        "warnings": [],
        "info": [],
        "registry": _registry_provenance(),
    }

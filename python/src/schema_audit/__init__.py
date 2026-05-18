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
from .errors import ErrorCode
from .registry import load_registry
from .types import Format, Issue, RegistryInfo, Severity, ValidationResult
from .validators.jsonld import validate_jsonld
from .validators.microdata import validate_microdata
from .validators.rdfa import validate_rdfa

VERSION = "1.0.0"
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


def _unknown_format_result(input_value: object, requested: Format) -> ValidationResult:
    from .errors import unknown_format

    return {
        "valid": False,
        "format": requested,
        "types": [],
        "errors": [unknown_format(input_value)],
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

    :param input_value: A JSON-LD string, a parsed ``dict``, or an HTML
        string. When ``format == "auto"`` (the default) the format is
        sniffed from the input shape. JSON arrays and other top-level
        types are routed through the JSON-LD parser, which will return
        a ``PARSE_ERROR`` result — matching the JS package exactly.
    :param format: one of ``"auto"`` | ``"jsonld"`` | ``"microdata"``
        | ``"rdfa"``. Passing a dict together with
        ``format="microdata"``/``"rdfa"`` returns an
        ``UNKNOWN_FORMAT`` result because Microdata and RDFa require
        an HTML string.
    :param strict: when True, warnings flip ``valid`` to ``False``.
    :returns: a :class:`ValidationResult` dict with the same shape JS
        emits.

    Examples::

        from schema_audit import validate

        # JSON-LD (dict or string)
        validate({"@context": "https://schema.org", "@type": "Product", ...})
        validate('{"@context":"https://schema.org","@type":"Product"}')

        # Microdata / RDFa (HTML string)
        validate('<div itemscope itemtype="https://schema.org/Product">…')
        validate('<div vocab="https://schema.org/" typeof="Product">…')

        # Force a format (skip detection)
        validate(html_string, format="microdata")
    """
    requested = format or "auto"

    # Non-string input is always JSON-LD shape — Microdata / RDFa need
    # an HTML string.
    if not isinstance(input_value, str):
        if requested == "microdata" or requested == "rdfa":
            return _unknown_format_result(input_value, cast(Format, requested))
        return validate_jsonld(input_value, strict=strict)

    # Resolve format from option or auto-detect.
    resolved: Format
    if requested == "auto":
        resolved = detect(input_value)
    else:
        resolved = cast(Format, requested)

    if resolved == "jsonld":
        return validate_jsonld(input_value, strict=strict)
    if resolved == "microdata":
        return validate_microdata(input_value, strict=strict)
    if resolved == "rdfa":
        return validate_rdfa(input_value, strict=strict)

    # "unknown" or any future format we don't yet handle.
    return _unknown_format_result(input_value, resolved)

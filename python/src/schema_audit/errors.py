"""Error-code constants and ``Issue`` factories for every code we emit.

Every code listed in the cycle's ``spec-delta.md`` is registered here
exactly once. Adding or renaming a code is a public-API change
(major version bump per Design Tenet #5).

Callers should NEVER construct ``Issue`` dicts by hand — they should go
through these factories so messages stay consistent and codes never
drift between JS and Python.

The set mirrors ``core/src/errors.ts`` 1:1 except for
``UNSUPPORTED_FORMAT``, which is Python-only for cycle 9 (the
JavaScript package already handles all three formats natively, so it
has no equivalent code).
"""

from __future__ import annotations

from typing import Final

from .types import Issue, Severity


class ErrorCode:
    """Stable UPPER_SNAKE_CASE codes emitted by validation issues.

    Use ``ErrorCode.MISSING_REQUIRED_PROPERTY`` (etc.) — never a string
    literal — so renames are caught at type-check time.
    """

    PARSE_ERROR: Final = "PARSE_ERROR"
    UNKNOWN_FORMAT: Final = "UNKNOWN_FORMAT"
    UNSUPPORTED_FORMAT: Final = "UNSUPPORTED_FORMAT"  # Python-only (cycle 9)
    MISSING_CONTEXT: Final = "MISSING_CONTEXT"
    INSECURE_CONTEXT: Final = "INSECURE_CONTEXT"
    NONSTANDARD_CONTEXT: Final = "NONSTANDARD_CONTEXT"
    MISSING_TYPE: Final = "MISSING_TYPE"
    UNKNOWN_TYPE: Final = "UNKNOWN_TYPE"
    UNKNOWN_PROPERTY: Final = "UNKNOWN_PROPERTY"
    INVALID_PROPERTY_VALUE_TYPE: Final = "INVALID_PROPERTY_VALUE_TYPE"
    INVALID_URL: Final = "INVALID_URL"
    MISSING_REQUIRED_PROPERTY: Final = "MISSING_REQUIRED_PROPERTY"
    MISSING_RECOMMENDED_PROPERTY: Final = "MISSING_RECOMMENDED_PROPERTY"
    NO_ITEMSCOPE: Final = "NO_ITEMSCOPE"
    MISSING_ITEMTYPE: Final = "MISSING_ITEMTYPE"
    INVALID_ITEMTYPE: Final = "INVALID_ITEMTYPE"
    NO_VOCAB: Final = "NO_VOCAB"


def _issue(
    severity: Severity,
    code: str,
    path: str,
    message: str,
    value: object,
) -> Issue:
    """Build a fully-populated ``Issue`` dict."""
    return {
        "type": severity,
        "code": code,
        "path": path,
        "message": message,
        "value": value,
    }


# ── Cross-format errors ─────────────────────────────────────────────────────


def parse_error(input_value: object, reason: str) -> Issue:
    return _issue(
        "error",
        ErrorCode.PARSE_ERROR,
        "",
        f"Input is not valid JSON: {reason}",
        input_value,
    )


def unknown_format(value: object) -> Issue:
    return _issue(
        "error",
        ErrorCode.UNKNOWN_FORMAT,
        "",
        "Could not auto-detect input format. Pass options.format explicitly.",
        value,
    )


def unsupported_format(requested: str) -> Issue:
    """Python-only (cycle 9). Returned when ``format`` is ``"microdata"`` or
    ``"rdfa"`` — the Python package validates JSON-LD only until cycle 10.
    """
    return _issue(
        "error",
        ErrorCode.UNSUPPORTED_FORMAT,
        "",
        (
            f"Format '{requested}' is detected but not yet validated by the "
            "Python package (JSON-LD only in v0.8.0). The JavaScript package "
            "supports all three formats; Python parity ships in the next release."
        ),
        requested,
    )


# ── @context ────────────────────────────────────────────────────────────────


def missing_context() -> Issue:
    return _issue(
        "error",
        ErrorCode.MISSING_CONTEXT,
        "",
        "JSON-LD object is missing @context.",
        None,
    )


def insecure_context(value: object) -> Issue:
    return _issue(
        "error",
        ErrorCode.INSECURE_CONTEXT,
        "@context",
        "@context must use https://, not http://.",
        value,
    )


def nonstandard_context(value: object) -> Issue:
    return _issue(
        "warning",
        ErrorCode.NONSTANDARD_CONTEXT,
        "@context",
        "@context is not schema.org. Schema validation may be inaccurate.",
        value,
    )


# ── @type ───────────────────────────────────────────────────────────────────


def missing_type() -> Issue:
    return _issue(
        "error",
        ErrorCode.MISSING_TYPE,
        "",
        "JSON-LD object is missing @type.",
        None,
    )


def unknown_type(type_name: object) -> Issue:
    return _issue(
        "error",
        ErrorCode.UNKNOWN_TYPE,
        "@type",
        f'@type "{type_name}" is not a recognized schema.org type.',
        type_name,
    )


# ── Property checks (Layer 1) ───────────────────────────────────────────────


def unknown_property(type_name: str, property_name: str, value: object) -> Issue:
    return _issue(
        "error",
        ErrorCode.UNKNOWN_PROPERTY,
        f"{type_name}.{property_name}",
        (
            f'Property "{property_name}" is not defined on type {type_name} '
            "or any of its ancestors."
        ),
        value,
    )


def _json_typeof(value: object) -> str:
    """Mirror JavaScript's ``typeof`` so messages match across runtimes."""
    if value is None:
        return "object"  # JS: typeof null === "object"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list | dict):
        return "object"
    return "object"


def invalid_property_value_type(
    type_name: str,
    property_name: str,
    expected: list[str],
    value: object,
) -> Issue:
    actual = _json_typeof(value)
    return _issue(
        "error",
        ErrorCode.INVALID_PROPERTY_VALUE_TYPE,
        f"{type_name}.{property_name}",
        (
            f'Property "{property_name}" on type {type_name} '
            f"expects one of [{', '.join(expected)}], got {actual}."
        ),
        value,
    )


def invalid_url(type_name: str, property_name: str, value: object) -> Issue:
    return _issue(
        "error",
        ErrorCode.INVALID_URL,
        f"{type_name}.{property_name}",
        f'Property "{property_name}" on type {type_name} is not a valid URL.',
        value,
    )


# ── Layer 2 — Google Rich Results ───────────────────────────────────────────


def missing_required_property(type_name: str, property_name: str) -> Issue:
    return _issue(
        "error",
        ErrorCode.MISSING_REQUIRED_PROPERTY,
        f"{type_name}.{property_name}",
        (
            f'Required property "{property_name}" is missing on type '
            f"{type_name} (Google Rich Results)."
        ),
        None,
    )


def missing_required_property_one_of(type_name: str, alternatives: list[str]) -> Issue:
    return _issue(
        "error",
        ErrorCode.MISSING_REQUIRED_PROPERTY,
        type_name,
        (
            f"Type {type_name} requires at least one of: "
            f"[{', '.join(alternatives)}] (Google Rich Results)."
        ),
        None,
    )


def missing_recommended_property(type_name: str, property_name: str) -> Issue:
    return _issue(
        "warning",
        ErrorCode.MISSING_RECOMMENDED_PROPERTY,
        f"{type_name}.{property_name}",
        (
            f'Recommended property "{property_name}" is missing on type '
            f"{type_name} (Google Rich Results)."
        ),
        None,
    )

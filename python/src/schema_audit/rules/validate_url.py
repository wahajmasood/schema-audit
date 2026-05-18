"""Atomic rule: validate that a value is a parseable absolute URL.

Mirrors ``core/src/rules/validate-url.ts``. JS uses the built-in
``URL`` constructor; Python uses :func:`urllib.parse.urlparse` with the
same intent — structural parseability only, never a network call.

Outcomes:

- non-string value         → ``INVALID_URL`` (error)
- string that won't parse  → ``INVALID_URL`` (error)
- parseable absolute URL   → no issue
"""

from __future__ import annotations

from urllib.parse import urlparse

from ..errors import invalid_url
from ..types import Issue


def _is_absolute_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except (ValueError, TypeError):
        return False
    # JS ``new URL("foo")`` throws if there's no scheme + host. Mirror that.
    return bool(parsed.scheme) and bool(parsed.netloc)


def validate_url(type_name: str, property_name: str, value: object) -> list[Issue]:
    if not isinstance(value, str):
        return [invalid_url(type_name, property_name, value)]
    if not _is_absolute_url(value):
        return [invalid_url(type_name, property_name, value)]
    return []

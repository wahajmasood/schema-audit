"""Atomic rule: validate a JSON-LD ``@context`` value.

Mirrors ``core/src/rules/validate-context.ts`` 1:1.

Outcomes:

- missing                       → ``MISSING_CONTEXT``    (error)
- ``http://schema.org``         → ``INSECURE_CONTEXT``   (error)
- any non-schema.org https URL  → ``NONSTANDARD_CONTEXT`` (warning)
- ``https://schema.org`` (any case) → no issue

Note: cycle 9 (and cycle 1 on the JS side) only handle ``@context`` as a
string. Object and array forms fall through to ``NONSTANDARD_CONTEXT``.
"""

from __future__ import annotations

import re

from ..errors import insecure_context, missing_context, nonstandard_context
from ..types import Issue

_HTTP_SCHEMA_RE = re.compile(r"^http://(www\.)?schema\.org\b", re.IGNORECASE)
_HTTPS_SCHEMA_RE = re.compile(r"^https://(www\.)?schema\.org\b", re.IGNORECASE)


def validate_context(value: object) -> list[Issue]:
    if value is None:
        return [missing_context()]

    if not isinstance(value, str):
        return [nonstandard_context(value)]

    if _HTTP_SCHEMA_RE.match(value):
        return [insecure_context(value)]

    if _HTTPS_SCHEMA_RE.match(value):
        return []

    return [nonstandard_context(value)]

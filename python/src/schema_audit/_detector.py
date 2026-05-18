"""Auto-detect the input's structured-data format.

Substring sniffing rather than full parsing — robust for anything
recognizably one of the supported formats; ``"unknown"`` for everything
else.

Order matters: JSON-LD (starts with ``{`` or ``[``) is unambiguous and
checked first. HTML inputs (start with ``<``) are then classified by
sniffing for Microdata (``itemscope`` / ``itemtype``) or RDFa
(``typeof=`` / ``vocab=``). When both indicators appear in the same
HTML, Microdata wins.

Mirrors ``core/src/utils/detector.ts`` 1:1.
"""

from __future__ import annotations

import re

from .types import Format

_MICRODATA_RE = re.compile(r"\b(?:itemscope|itemtype)\b", re.IGNORECASE)
_RDFA_RE = re.compile(r"\b(?:typeof|vocab)\s*=", re.IGNORECASE)


def detect(input_value: str) -> Format:
    if not isinstance(input_value, str) or len(input_value) == 0:
        return "unknown"

    trimmed = input_value.lstrip()
    if len(trimmed) == 0:
        return "unknown"

    first = trimmed[0]
    if first in ("{", "["):
        return "jsonld"

    if first == "<":
        if _MICRODATA_RE.search(input_value):
            return "microdata"
        if _RDFA_RE.search(input_value):
            return "rdfa"
        return "unknown"

    return "unknown"

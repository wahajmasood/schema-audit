"""Shared pytest helpers for the schema-audit Python suite."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Make ``schema_audit`` importable without a `pip install -e .` step,
# so the test suite runs cleanly in CI checkouts that haven't been
# editable-installed.
_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load_fixture(category: str, name: str) -> dict[str, object]:
    """Load and parse a JSON fixture file.

    :param category: ``"valid"`` or ``"invalid"``
    :param name: filename without extension (e.g. ``"typical-product"``)
    """
    path = FIXTURES / category / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def fixture_text(category: str, name: str) -> str:
    """Return the raw JSON text of a fixture (for string-input tests)."""
    path = FIXTURES / category / f"{name}.json"
    return path.read_text(encoding="utf-8")

"""Cycle 9 — cross-language parity assertion.

Each ``tests/conformance/<name>.input.json`` is paired with the
normalized expected output in ``<name>.golden.json``. The JavaScript
suite asserts against the same goldens, so any divergence between the
two runtimes will fail at least one CI.

To regenerate goldens (intentional behavior changes only)::

    node scripts/regen-conformance.mjs

That script verifies JS and Python agree before it writes.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from schema_audit import validate

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CORPUS_DIR = REPO_ROOT / "tests" / "conformance"


def _deep_sort(value: object) -> object:
    if isinstance(value, list):
        return [_deep_sort(v) for v in value]
    if isinstance(value, dict):
        return {k: _deep_sort(v) for k, v in sorted(value.items())}
    return value


def _normalize(result: object) -> object:
    """Stamp out the snapshotAt timestamp and deep-sort keys."""
    snapshot = copy.deepcopy(result)
    if isinstance(snapshot, dict):
        registry = snapshot.get("registry")
        if isinstance(registry, dict):
            registry["snapshotAt"] = "<NORMALIZED>"
    return _deep_sort(snapshot)


def _discover_fixtures() -> list[tuple[str, Path, Path]]:
    out: list[tuple[str, Path, Path]] = []
    if not CORPUS_DIR.exists():
        return out
    for input_path in sorted(CORPUS_DIR.glob("*.input.json")):
        name = input_path.name[: -len(".input.json")]
        golden_path = input_path.with_name(name + ".golden.json")
        out.append((name, input_path, golden_path))
    return out


FIXTURES = _discover_fixtures()


def test_corpus_is_non_empty():
    assert len(FIXTURES) > 0, (
        f"No conformance fixtures found in {CORPUS_DIR}. "
        "Did the repo skip the cycle-9 conformance corpus?"
    )


@pytest.mark.parametrize(
    ("name", "input_path", "golden_path"),
    FIXTURES,
    ids=[f[0] for f in FIXTURES],
)
def test_python_matches_golden(name: str, input_path: Path, golden_path: Path):
    input_value = json.loads(input_path.read_text(encoding="utf-8"))
    golden = json.loads(golden_path.read_text(encoding="utf-8"))

    actual = _normalize(validate(input_value))

    assert actual == golden, (
        f"Python conformance drift on {name}. "
        "Regenerate goldens with `node scripts/regen-conformance.mjs` "
        "after confirming both implementations agree."
    )

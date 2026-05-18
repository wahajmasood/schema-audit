"""CLI integration tests.

Mirrors the 12 scenarios in ``core/tests/cli.test.ts`` so the Python
and JS CLIs are demonstrably parallel. All tests drive the CLI through
:func:`schema_audit.cli.main` with ``io.StringIO``-backed streams; no
subprocesses, no real file I/O.
"""

from __future__ import annotations

import io
import json
import re

from schema_audit import VERSION
from schema_audit.cli import main

VALID_PRODUCT = json.dumps(
    {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Widget",
        "image": "https://example.com/w.jpg",
        "offers": "https://example.com/o",
    }
)
INVALID_PRODUCT = json.dumps(
    {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "No Offers",
        "image": "https://example.com/x.jpg",
    }
)
MICRODATA_HTML = """<!DOCTYPE html><html><body>
  <div itemscope itemtype="https://schema.org/Product">
    <meta itemprop="name" content="X">
    <img itemprop="image" src="https://x.com/x.jpg" alt="">
    <link itemprop="offers" href="https://x.com/o">
  </div>
</body></html>"""

VALID_PRODUCT_FILE = "/fake/valid-product.json"
INVALID_PRODUCT_FILE = "/fake/invalid-product.json"
MICRODATA_FILE = "/fake/page.html"
BARE_PRODUCT_FILE = "/fake/bare-product.json"

_FIXTURES = {
    VALID_PRODUCT_FILE: VALID_PRODUCT,
    INVALID_PRODUCT_FILE: INVALID_PRODUCT,
    MICRODATA_FILE: MICRODATA_HTML,
    BARE_PRODUCT_FILE: VALID_PRODUCT,  # populated per-test if needed
}


def _read_fixture(path: str) -> str:
    if path not in _FIXTURES:
        raise FileNotFoundError(f"ENOENT: no such file or directory, open '{path}'")
    return _FIXTURES[path]


def _run(argv: list[str], stdin: str | None = None) -> tuple[int, str, str]:
    out = io.StringIO()
    err = io.StringIO()
    code = main(
        argv=argv,
        stdin=io.StringIO(stdin) if stdin is not None else None,
        stdout=out,
        stderr=err,
        read_file=_read_fixture,
    )
    return code, out.getvalue(), err.getvalue()


# ── Scenario 1: validate a valid JSON-LD file ──────────────────────────────


def test_scenario_1_valid_json_exits_0():
    code, out, err = _run(["validate", VALID_PRODUCT_FILE])
    assert code == 0
    assert re.search(r"✓ Product \(valid\)", out)
    assert err == ""


# ── Scenario 2: validate an invalid file (implicit validate) ──────────────


def test_scenario_2_invalid_exits_1():
    code, out, _ = _run([INVALID_PRODUCT_FILE])
    assert code == 1
    assert re.search(r"✗ Product \(invalid\)", out)
    assert "MISSING_REQUIRED_PROPERTY" in out


# ── Scenario 3: stdin input ────────────────────────────────────────────────


def test_scenario_3_stdin_no_file():
    code, out, _ = _run([], stdin=VALID_PRODUCT)
    assert code == 0
    assert re.search(r"✓ Product \(valid\)", out)


def test_scenario_3_dash_positional_reads_stdin():
    code, out, _ = _run(["-"], stdin=VALID_PRODUCT)
    assert code == 0
    assert re.search(r"✓ Product \(valid\)", out)


# ── Scenario 4: detect subcommand ──────────────────────────────────────────


def test_scenario_4_detect_microdata():
    code, out, _ = _run(["detect", MICRODATA_FILE])
    assert code == 0
    assert out.strip() == "microdata"


# ── Scenario 5: --format override ──────────────────────────────────────────


def test_scenario_5_explicit_format_jsonld():
    code, _, _ = _run(["validate", "--format", "jsonld", VALID_PRODUCT_FILE])
    assert code == 0


def test_scenario_5_invalid_format_exits_2():
    code, _, err = _run(["validate", "--format", "xyz", VALID_PRODUCT_FILE])
    assert code == 2
    assert "invalid --format" in err


# ── Scenario 6: --strict flips warnings to invalid ─────────────────────────


def test_scenario_6_strict_warnings():
    # Bare valid Product → 6 missing-recommended warnings → strict makes it invalid.
    code, _, _ = _run(["validate", "--strict", VALID_PRODUCT_FILE])
    assert code == 1


# ── Scenario 7: --json output ──────────────────────────────────────────────


def test_scenario_7_json_output_is_parseable():
    code, out, _ = _run(["validate", "--json", VALID_PRODUCT_FILE])
    assert code == 0
    parsed = json.loads(out)
    assert parsed["valid"] is True
    assert parsed["format"] == "jsonld"
    assert parsed["types"] == ["Product"]
    assert "registry" in parsed


# ── Scenario 8: --help ─────────────────────────────────────────────────────


def test_scenario_8_help_long():
    code, out, _ = _run(["--help"])
    assert code == 0
    assert "Usage:" in out
    assert "validate" in out
    assert "detect" in out
    assert "Options:" in out
    assert "Exit codes:" in out


def test_scenario_8_help_short():
    code, out, _ = _run(["-h"])
    assert code == 0
    assert "Usage:" in out


# ── Scenario 9: --version ─────────────────────────────────────────────────


def test_scenario_9_version_long():
    code, out, _ = _run(["--version"])
    assert code == 0
    assert out.strip() == f"schema-audit v{VERSION}"


def test_scenario_9_version_short():
    code, out, _ = _run(["-v"])
    assert code == 0
    assert out.strip() == f"schema-audit v{VERSION}"


# ── Scenario 10: unknown subcommand treated as a file path ────────────────


def test_scenario_10_unknown_positional_treated_as_file():
    code, _, err = _run(["xyz", "ignored"])
    assert code == 2
    assert "cannot read xyz" in err


# ── Scenario 11: file doesn't exist ───────────────────────────────────────


def test_scenario_11_missing_file():
    code, _, err = _run(["validate", "/fake/does-not-exist.json"])
    assert code == 2
    assert "cannot read /fake/does-not-exist.json" in err


# ── Scenario 12: unrecognized flag ────────────────────────────────────────


def test_scenario_12_unknown_flag():
    code, _, err = _run(["validate", "--crazy", VALID_PRODUCT_FILE])
    assert code == 2
    assert err  # stderr non-empty


# ── Microdata file end-to-end ─────────────────────────────────────────────


def test_microdata_file_validates_via_cli():
    code, out, _ = _run([MICRODATA_FILE])
    # The fixture has all required Product props (name, image, offers),
    # so the validator returns valid with warnings for missing recommended.
    assert code == 0
    assert re.search(r"✓ Product \(valid\)", out)
    assert "format: microdata" in out

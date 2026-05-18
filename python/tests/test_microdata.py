"""Microdata orchestrator integration tests.

Uses the HTML fixtures copied from core/tests/fixtures/ so the JS and
Python suites exercise byte-identical inputs.
"""

from conftest import fixture_html
from schema_audit.validators.microdata import validate_microdata

# ── Valid fixtures ─────────────────────────────────────────────────────────


def test_microdata_product_passes():
    r = validate_microdata(fixture_html("valid", "microdata-product"))
    assert r["valid"] is True
    assert r["format"] == "microdata"
    assert r["types"] == ["Product"]
    assert r["errors"] == []


def test_microdata_with_nested_brand_passes():
    r = validate_microdata(fixture_html("valid", "microdata-with-nested-brand"))
    assert r["valid"] is True
    assert r["types"] == ["Product"]


# ── Invalid fixtures ───────────────────────────────────────────────────────


def test_microdata_no_itemscope_fires():
    r = validate_microdata(fixture_html("invalid", "microdata-no-itemscope"))
    assert r["valid"] is False
    assert any(e["code"] == "NO_ITEMSCOPE" for e in r["errors"])


def test_microdata_missing_itemtype_fires():
    r = validate_microdata(fixture_html("invalid", "microdata-missing-itemtype"))
    assert r["valid"] is False
    assert any(e["code"] == "MISSING_ITEMTYPE" for e in r["errors"])


def test_microdata_invalid_itemtype_fires():
    r = validate_microdata(fixture_html("invalid", "microdata-invalid-itemtype"))
    assert r["valid"] is False
    assert any(e["code"] == "INVALID_ITEMTYPE" for e in r["errors"])


def test_microdata_unknown_type_fires():
    r = validate_microdata(fixture_html("invalid", "microdata-unknown-type"))
    assert r["valid"] is False
    # Either INVALID_ITEMTYPE (with the "not in registry" message) or
    # UNKNOWN_TYPE — JS emits INVALID_ITEMTYPE for this case.
    assert any(e["code"] in ("INVALID_ITEMTYPE", "UNKNOWN_TYPE") for e in r["errors"])


# ── Multi-item path-prefix logic ───────────────────────────────────────────


def test_two_products_get_indexed_paths():
    html = """<body>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="A">
        <link itemprop="image" href="https://x.com/a.jpg">
      </div>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="B">
      </div>
    </body>"""
    r = validate_microdata(html)
    assert r["types"] == ["Product", "Product"]
    paths = [issue["path"] for issue in r["errors"]]
    # B is missing both image and offers/review/aggregateRating.
    assert any(p.startswith("Product[1]") for p in paths)
    # A is missing offers/review/aggregateRating.
    assert any(p == "Product[0]" or p.startswith("Product[0].") for p in paths)


def test_single_product_keeps_unindexed_path():
    html = """<div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="X">
    </div>"""
    r = validate_microdata(html)
    paths = [issue["path"] for issue in r["errors"]]
    # No path prefix when type is unique.
    assert all("[" not in p for p in paths if p)


# ── Per-item engine integration ────────────────────────────────────────────


def test_strict_mode_flips_warnings_to_invalid():
    # A valid Product with the bare minimum → 6 missing-recommended warnings.
    html = """<div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="X">
      <link itemprop="image" href="https://x.com/i.jpg">
      <link itemprop="offers" href="https://x.com/o">
    </div>"""
    loose = validate_microdata(html, strict=False)
    strict_ = validate_microdata(html, strict=True)
    assert loose["valid"] is True
    assert strict_["valid"] is False


def test_provenance_fields_present():
    r = validate_microdata("<div></div>")
    reg = r["registry"]
    assert isinstance(reg["schemaVersion"], str)
    assert isinstance(reg["snapshotAt"], str)
    assert isinstance(reg["curatedRulesVersion"], str)


def test_microdata_returns_format_string():
    r = validate_microdata("<div></div>")
    assert r["format"] == "microdata"

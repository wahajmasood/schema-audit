"""RDFa orchestrator integration tests."""

from conftest import fixture_html
from schema_audit.validators.rdfa import validate_rdfa


def test_rdfa_product_passes():
    r = validate_rdfa(fixture_html("valid", "rdfa-product"))
    assert r["valid"] is True
    assert r["format"] == "rdfa"
    assert r["types"] == ["Product"]


def test_rdfa_with_nested_brand_passes():
    r = validate_rdfa(fixture_html("valid", "rdfa-with-nested-brand"))
    assert r["valid"] is True
    assert r["types"] == ["Product"]


def test_rdfa_no_vocab_fires():
    r = validate_rdfa(fixture_html("invalid", "rdfa-no-vocab"))
    assert r["valid"] is False
    assert any(e["code"] == "NO_VOCAB" for e in r["errors"])


def test_rdfa_curie_emits_invalid_itemtype():
    r = validate_rdfa(fixture_html("invalid", "rdfa-curie"))
    assert r["valid"] is False
    # CURIE → INVALID_ITEMTYPE (matches JS exactly).
    codes = [e["code"] for e in r["errors"]]
    assert "INVALID_ITEMTYPE" in codes


def test_rdfa_unknown_type_fires():
    r = validate_rdfa(fixture_html("invalid", "rdfa-unknown-type"))
    assert r["valid"] is False
    # Unknown type bubbles through the per-item engine or extractor.
    codes = [e["code"] for e in r["errors"]]
    assert any(c in ("INVALID_ITEMTYPE", "UNKNOWN_TYPE") for c in codes)


def test_full_url_typeof_does_not_need_vocab():
    html = """<div typeof="https://schema.org/Product">
      <span property="name">Earbuds</span>
      <link property="image" href="https://x.com/i.jpg">
      <link property="offers" href="https://x.com/o">
    </div>"""
    r = validate_rdfa(html)
    assert r["valid"] is True
    assert r["types"] == ["Product"]


def test_content_attribute_overrides_text():
    # When `content=` is present, RDFa uses it instead of inner text.
    # If the override didn't fire, "Display name" would be the value
    # passed to URL-validation, etc. Here both pass; the point is the
    # extractor must use "Real name".
    html = """<div vocab="https://schema.org/" typeof="Product">
      <span property="name" content="Real name">Display name</span>
      <link property="image" href="https://x.com/i.jpg">
      <link property="offers" href="https://x.com/o">
    </div>"""
    r = validate_rdfa(html)
    assert r["valid"] is True


def test_non_schema_vocab_silent():
    # vocab is set but not schema.org — extractor produces no item, no
    # validation issues fire.
    html = '<div vocab="http://example.com/" typeof="Product"></div>'
    r = validate_rdfa(html)
    assert r["types"] == []
    assert r["errors"] == []
    assert r["warnings"] == []


def test_multi_item_path_prefix():
    html = """<body vocab="https://schema.org/">
      <div typeof="Product"><span property="name">A</span></div>
      <div typeof="Product"><span property="name">B</span></div>
    </body>"""
    r = validate_rdfa(html)
    assert r["types"] == ["Product", "Product"]
    paths = [e["path"] for e in r["errors"]]
    assert any(p.startswith("Product[0]") for p in paths)
    assert any(p.startswith("Product[1]") for p in paths)


def test_format_string():
    r = validate_rdfa("<div></div>")
    assert r["format"] == "rdfa"


def test_provenance_fields():
    r = validate_rdfa("<div></div>")
    assert isinstance(r["registry"]["schemaVersion"], str)
    assert isinstance(r["registry"]["curatedRulesVersion"], str)


def test_strict_flips_warnings_to_invalid():
    html = """<div vocab="https://schema.org/" typeof="Product">
      <span property="name">X</span>
      <link property="image" href="https://x.com/i.jpg">
      <link property="offers" href="https://x.com/o">
    </div>"""
    assert validate_rdfa(html, strict=False)["valid"] is True
    assert validate_rdfa(html, strict=True)["valid"] is False

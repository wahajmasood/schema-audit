"""Tests for the Python-only UNSUPPORTED_FORMAT path.

In v0.8.0 the Python package detects Microdata and RDFa but does not
yet validate them. Instead it returns a structured result so callers
don't have to special-case ``None``.
"""

from schema_audit import validate

MICRODATA = '<div itemscope itemtype="https://schema.org/Product"><meta itemprop="name" content="X"></div>'
RDFA = '<div vocab="https://schema.org/" typeof="Product"><span property="name">X</span></div>'


def test_auto_detected_microdata_returns_unsupported_format():
    r = validate(MICRODATA)
    assert r["valid"] is False
    assert r["format"] == "microdata"
    assert r["types"] == []
    assert r["errors"][0]["code"] == "UNSUPPORTED_FORMAT"


def test_auto_detected_rdfa_returns_unsupported_format():
    r = validate(RDFA)
    assert r["valid"] is False
    assert r["format"] == "rdfa"
    assert r["errors"][0]["code"] == "UNSUPPORTED_FORMAT"


def test_explicit_format_microdata_with_dict_input():
    r = validate({"@type": "Product"}, format="microdata")
    assert r["format"] == "microdata"
    assert r["errors"][0]["code"] == "UNSUPPORTED_FORMAT"


def test_explicit_format_rdfa_with_string_input():
    r = validate("<anything>", format="rdfa")
    assert r["format"] == "rdfa"
    assert r["errors"][0]["code"] == "UNSUPPORTED_FORMAT"


def test_unsupported_format_result_has_complete_shape():
    r = validate(MICRODATA)
    # All seven top-level keys present.
    for key in ("valid", "format", "types", "errors", "warnings", "info", "registry"):
        assert key in r
    # Registry provenance is intact.
    assert isinstance(r["registry"]["schemaVersion"], str)


def test_unsupported_format_message_mentions_cycle_10():
    r = validate(MICRODATA)
    msg = r["errors"][0]["message"]
    assert "Python" in msg

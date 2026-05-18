"""Tests for the format detector."""

from schema_audit import detect


def test_jsonld_object():
    assert detect('{"@context":"https://schema.org","@type":"Product"}') == "jsonld"


def test_jsonld_array():
    assert detect("[1, 2, 3]") == "jsonld"


def test_jsonld_with_leading_whitespace():
    assert detect('  \n  {"@type":"X"}') == "jsonld"


def test_microdata_itemscope_itemtype():
    assert (
        detect('<div itemscope itemtype="https://schema.org/Product"></div>')
        == "microdata"
    )


def test_microdata_itemtype_alone_still_routes_microdata():
    # itemtype without itemscope is broken markup; routing it to
    # Microdata means it surfaces NO_ITEMSCOPE rather than UNKNOWN_FORMAT.
    assert detect('<div itemtype="https://schema.org/Product"></div>') == "microdata"


def test_microdata_case_insensitive():
    assert detect("<DIV ITEMSCOPE ITEMTYPE='x'></DIV>") == "microdata"


def test_rdfa_vocab():
    assert detect('<div vocab="https://schema.org/" typeof="Product"></div>') == "rdfa"


def test_rdfa_typeof_only():
    assert detect('<div typeof="schema:Product"></div>') == "rdfa"


def test_microdata_wins_when_both_present():
    html = '<div itemscope vocab="https://schema.org/"></div>'
    assert detect(html) == "microdata"


def test_unknown_for_plain_text():
    assert detect("plain text here") == "unknown"


def test_unknown_for_empty_string():
    assert detect("") == "unknown"


def test_unknown_for_whitespace_only():
    assert detect("   \n\t  ") == "unknown"


def test_unknown_for_unrelated_html():
    assert detect("<p>just a paragraph</p>") == "unknown"

"""Tests for the URL atomic rule."""

from schema_audit.rules.validate_url import validate_url


def test_valid_https_url_passes():
    assert validate_url("Product", "url", "https://example.com/path") == []


def test_valid_http_url_passes():
    assert validate_url("Product", "url", "http://example.com") == []


def test_url_with_query_and_fragment_passes():
    assert validate_url(
        "Product", "url", "https://example.com/path?q=1#frag"
    ) == []


def test_relative_path_rejected():
    issues = validate_url("Product", "url", "/just-a-path")
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_URL"


def test_bare_domain_rejected():
    issues = validate_url("Product", "url", "example.com")
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_URL"


def test_non_string_rejected():
    issues = validate_url("Product", "url", 42)
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_URL"


def test_empty_string_rejected():
    issues = validate_url("Product", "url", "")
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_URL"


def test_none_rejected():
    issues = validate_url("Product", "url", None)
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_URL"

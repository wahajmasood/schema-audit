"""Tests for the @context atomic rule.

Mirrors core/tests/rules/validate-context.test.ts.
"""

from schema_audit.rules.validate_context import validate_context


def test_missing_context_emits_missing_code():
    issues = validate_context(None)
    assert len(issues) == 1
    assert issues[0]["code"] == "MISSING_CONTEXT"
    assert issues[0]["type"] == "error"


def test_https_schema_org_passes():
    assert validate_context("https://schema.org") == []
    assert validate_context("https://schema.org/") == []
    assert validate_context("https://www.schema.org") == []


def test_https_schema_org_case_insensitive():
    assert validate_context("HTTPS://SCHEMA.ORG") == []


def test_http_schema_org_is_insecure():
    issues = validate_context("http://schema.org")
    assert len(issues) == 1
    assert issues[0]["code"] == "INSECURE_CONTEXT"
    assert issues[0]["path"] == "@context"
    assert issues[0]["value"] == "http://schema.org"


def test_other_https_url_is_nonstandard():
    issues = validate_context("https://example.org/")
    assert len(issues) == 1
    assert issues[0]["code"] == "NONSTANDARD_CONTEXT"
    assert issues[0]["type"] == "warning"


def test_non_string_value_is_nonstandard():
    issues = validate_context({"@vocab": "https://schema.org"})
    assert len(issues) == 1
    assert issues[0]["code"] == "NONSTANDARD_CONTEXT"

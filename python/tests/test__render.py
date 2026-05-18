"""Smoke tests for the human-readable render helper.

Mirrors core/tests/cli/render.test.ts.
"""

from __future__ import annotations

import re

from schema_audit._render import render_human
from schema_audit.types import ValidationResult


def _make_result(**overrides: object) -> ValidationResult:
    base: ValidationResult = {
        "valid": True,
        "format": "jsonld",
        "types": ["Product"],
        "errors": [],
        "warnings": [],
        "info": [],
        "registry": {
            "schemaVersion": "schema.org-2026-05-18",
            "snapshotAt": "2026-05-18T00:00:00Z",
            "curatedRulesVersion": "google-rich-results-docs-2026-05-16",
        },
    }
    base.update(overrides)  # type: ignore[typeddict-item]
    return base


def test_valid_with_no_issues():
    out = render_human(_make_result(), version="0.9.0")
    assert re.search(r"✓ Product \(valid\)", out)
    assert "No errors. No warnings." in out
    assert "schema-audit v0.9.0" in out
    assert "format: jsonld" in out
    assert "registry: schema.org-2026-05-18" in out


def test_valid_with_warnings():
    result = _make_result(
        warnings=[
            {
                "type": "warning",
                "code": "MISSING_RECOMMENDED_PROPERTY",
                "path": "Product.brand",
                "message": 'Recommended property "brand" is missing.',
                "value": None,
            },
            {
                "type": "warning",
                "code": "MISSING_RECOMMENDED_PROPERTY",
                "path": "Product.sku",
                "message": 'Recommended property "sku" is missing.',
                "value": None,
            },
        ],
    )
    out = render_human(result, version="0.9.0")
    assert "✓ Product (valid)" in out
    assert "0 errors, 2 warnings" in out
    assert "[W] MISSING_RECOMMENDED_PROPERTY at Product.brand" in out
    assert "[W] MISSING_RECOMMENDED_PROPERTY at Product.sku" in out


def test_invalid_with_errors():
    result = _make_result(
        valid=False,
        errors=[
            {
                "type": "error",
                "code": "MISSING_REQUIRED_PROPERTY",
                "path": "Product",
                "message": (
                    "Type Product requires at least one of: "
                    "[offers, review, aggregateRating] (Google Rich Results)."
                ),
                "value": None,
            },
        ],
    )
    out = render_human(result, version="0.9.0")
    assert "✗ Product (invalid)" in out
    assert "1 error, 0 warnings" in out
    assert "[E] MISSING_REQUIRED_PROPERTY at Product" in out


def test_empty_result_no_items():
    result = _make_result(types=[], format="microdata")
    out = render_human(result, version="0.9.0")
    assert "∅ No items found" in out
    assert "format: microdata" in out


def test_error_with_empty_path_omits_at_suffix():
    result = _make_result(
        valid=False,
        errors=[
            {
                "type": "error",
                "code": "PARSE_ERROR",
                "path": "",
                "message": "Input is not valid JSON: Unexpected token.",
                "value": None,
            },
        ],
    )
    out = render_human(result, version="0.9.0")
    assert "[E] PARSE_ERROR\n" in out
    assert "[E] PARSE_ERROR at " not in out


def test_at_context_path_preserved():
    result = _make_result(
        valid=False,
        errors=[
            {
                "type": "error",
                "code": "INSECURE_CONTEXT",
                "path": "@context",
                "message": "@context must use https://, not http://.",
                "value": "http://schema.org",
            },
        ],
    )
    out = render_human(result, version="0.9.0")
    assert "[E] INSECURE_CONTEXT at @context" in out

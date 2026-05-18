"""Smoke checks for the public import surface."""

import schema_audit


def test_validate_is_callable():
    assert callable(schema_audit.validate)


def test_detect_is_callable():
    assert callable(schema_audit.detect)


def test_version_is_string():
    assert isinstance(schema_audit.VERSION, str)
    assert schema_audit.VERSION == "1.0.0"
    assert schema_audit.__version__ == schema_audit.VERSION


def test_error_code_constants_exposed():
    assert schema_audit.ErrorCode.MISSING_CONTEXT == "MISSING_CONTEXT"
    assert schema_audit.ErrorCode.MISSING_REQUIRED_PROPERTY == "MISSING_REQUIRED_PROPERTY"
    assert schema_audit.ErrorCode.NO_ITEMSCOPE == "NO_ITEMSCOPE"
    assert schema_audit.ErrorCode.NO_VOCAB == "NO_VOCAB"
    # UNSUPPORTED_FORMAT was retired in cycle 10 (Python gained Microdata + RDFa).
    assert not hasattr(schema_audit.ErrorCode, "UNSUPPORTED_FORMAT")


def test_validate_returns_dict_with_locked_shape():
    r = schema_audit.validate({"@context": "https://schema.org", "@type": "Product"})
    assert isinstance(r, dict)
    for key in ("valid", "format", "types", "errors", "warnings", "info", "registry"):
        assert key in r
    assert isinstance(r["valid"], bool)
    assert isinstance(r["types"], list)
    assert isinstance(r["errors"], list)


def test_validate_accepts_string_input():
    r = schema_audit.validate('{"@context":"https://schema.org","@type":"Product"}')
    assert isinstance(r, dict)


def test_validate_accepts_dict_input():
    r = schema_audit.validate({"@context": "https://schema.org", "@type": "Product"})
    assert isinstance(r, dict)


def test_validate_default_format_is_auto():
    # Calling without an explicit format should still work
    r = schema_audit.validate({"@type": "Product"})
    assert r["format"] == "jsonld"


def test_validate_strict_kwarg_supported():
    r = schema_audit.validate({"@type": "Product"}, strict=True)
    assert isinstance(r, dict)

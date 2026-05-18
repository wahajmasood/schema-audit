"""Tests for the @type atomic rule."""

from schema_audit.registry import load_registry
from schema_audit.rules.validate_type import validate_type

R = load_registry()


def test_none_is_missing_type():
    issues = validate_type(None, R)
    assert len(issues) == 1
    assert issues[0]["code"] == "MISSING_TYPE"


def test_empty_string_is_missing_type():
    issues = validate_type("", R)
    assert len(issues) == 1
    assert issues[0]["code"] == "MISSING_TYPE"


def test_non_string_is_unknown_type():
    issues = validate_type(42, R)
    assert len(issues) == 1
    assert issues[0]["code"] == "UNKNOWN_TYPE"
    assert issues[0]["value"] == 42


def test_string_not_in_registry_is_unknown_type():
    issues = validate_type("ZagglefrogFoobar", R)
    assert len(issues) == 1
    assert issues[0]["code"] == "UNKNOWN_TYPE"


def test_registered_type_passes():
    assert validate_type("Product", R) == []
    assert validate_type("Article", R) == []
    assert validate_type("Person", R) == []

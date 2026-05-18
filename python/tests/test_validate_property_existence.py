"""Tests for the property-existence atomic rule."""

from schema_audit.registry import load_registry
from schema_audit.rules.validate_property_existence import validate_property_existence

R = load_registry()


def test_own_property_passes():
    assert validate_property_existence("Product", "brand", "X", R) == []


def test_inherited_property_passes():
    # `name` is defined on Thing — Product inherits it via the pre-flattened
    # allProperties map.
    assert validate_property_existence("Product", "name", "X", R) == []


def test_url_property_inherited_from_thing():
    assert validate_property_existence("Product", "url", "https://x.com", R) == []


def test_unknown_property_emits_error():
    issues = validate_property_existence("Product", "bogusFooProperty", "X", R)
    assert len(issues) == 1
    assert issues[0]["code"] == "UNKNOWN_PROPERTY"
    assert issues[0]["path"] == "Product.bogusFooProperty"


def test_unknown_type_is_silent():
    # If the type isn't in the registry, the property check returns no
    # issue — `validate_type` is responsible for surfacing that.
    assert validate_property_existence("NotAType", "name", "X", R) == []

"""Tests for the property value-type atomic rule."""

from schema_audit.rules.validate_property_value_type import (
    validate_property_value_type,
)


def test_string_accepts_text():
    assert validate_property_value_type("Product", "name", "Widget", ["Text"]) == []


def test_string_accepts_url():
    assert validate_property_value_type(
        "Product", "url", "https://example.com", ["URL"]
    ) == []


def test_string_accepts_object_type_as_url_reference():
    # schema.org allows object-typed properties to be referenced by URL.
    assert validate_property_value_type(
        "Product",
        "offers",
        "https://example.com/o",
        ["Offer", "AggregateOffer"],
    ) == []


def test_number_rejected_for_text():
    issues = validate_property_value_type("Product", "name", 42, ["Text"])
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_PROPERTY_VALUE_TYPE"
    assert "got number" in issues[0]["message"]


def test_bool_rejected_for_text():
    issues = validate_property_value_type("Product", "name", True, ["Text"])
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_PROPERTY_VALUE_TYPE"
    assert "got boolean" in issues[0]["message"]


def test_bool_accepts_boolean_type():
    assert validate_property_value_type(
        "Product", "inStock", True, ["Boolean"]
    ) == []


def test_number_accepts_number():
    assert validate_property_value_type("Product", "qty", 12, ["Number"]) == []
    assert validate_property_value_type("Product", "qty", 12.5, ["Number"]) == []
    assert validate_property_value_type("Product", "qty", 12, ["Integer"]) == []


def test_dict_accepts_object_type():
    assert validate_property_value_type(
        "Product", "offers", {"@type": "Offer"}, ["Offer"]
    ) == []


def test_none_returns_empty():
    # The orchestrator decides whether missing is a separate concern.
    assert validate_property_value_type("Product", "name", None, ["Text"]) == []


def test_list_currently_unsupported():
    issues = validate_property_value_type("Product", "name", ["a", "b"], ["Text"])
    assert len(issues) == 1
    assert issues[0]["code"] == "INVALID_PROPERTY_VALUE_TYPE"

"""Tests for the Layer-2 recommended atomic rule."""

from schema_audit.curated_rules import get_curated_rules
from schema_audit.rules.validate_recommended import validate_recommended

PROD = get_curated_rules("Product")
assert PROD is not None


def test_all_recommended_present_no_issues():
    obj: dict[str, object] = {name: "x" for name in PROD["recommended"]}
    assert validate_recommended(obj, "Product", PROD["recommended"]) == []


def test_each_missing_recommended_warns():
    issues = validate_recommended({}, "Product", PROD["recommended"])
    assert len(issues) == len(PROD["recommended"])
    for issue in issues:
        assert issue["code"] == "MISSING_RECOMMENDED_PROPERTY"
        assert issue["type"] == "warning"
        assert issue["path"].startswith("Product.")


def test_none_value_counts_as_missing():
    obj: dict[str, object] = {name: "x" for name in PROD["recommended"]}
    obj["brand"] = None
    issues = validate_recommended(obj, "Product", PROD["recommended"])
    assert len(issues) == 1
    assert issues[0]["path"] == "Product.brand"


def test_partial_recommended_warns_only_missing():
    half = PROD["recommended"][: len(PROD["recommended"]) // 2]
    obj: dict[str, object] = {name: "x" for name in half}
    issues = validate_recommended(obj, "Product", PROD["recommended"])
    assert len(issues) == len(PROD["recommended"]) - len(half)

"""Tests for the Layer-2 required atomic rule."""

from schema_audit.curated_rules import get_curated_rules
from schema_audit.rules.validate_required import validate_required

PROD = get_curated_rules("Product")
assert PROD is not None


def test_all_required_present_no_issues():
    issues = validate_required(
        {"name": "X", "image": "https://x.com/i.jpg", "offers": "https://x.com/o"},
        "Product",
        PROD["required"],
        PROD["requiredOneOf"],
    )
    assert issues == []


def test_missing_simple_required_emits_one_issue_per_field():
    issues = validate_required(
        {"offers": "https://x.com/o"},
        "Product",
        PROD["required"],
        PROD["requiredOneOf"],
    )
    # name + image both missing → 2 simple-required issues
    codes = [i["code"] for i in issues]
    paths = [i["path"] for i in issues]
    assert codes.count("MISSING_REQUIRED_PROPERTY") >= 2
    assert "Product.name" in paths
    assert "Product.image" in paths


def test_missing_oneof_emits_oneof_issue():
    issues = validate_required(
        {"name": "X", "image": "https://x.com/i.jpg"},  # no offers/review/aggregateRating
        "Product",
        PROD["required"],
        PROD["requiredOneOf"],
    )
    one_of = [i for i in issues if "least one of" in i["message"]]
    assert len(one_of) == 1
    assert one_of[0]["code"] == "MISSING_REQUIRED_PROPERTY"
    assert one_of[0]["path"] == "Product"


def test_oneof_satisfied_by_any_alternative():
    for alt in ("offers", "review", "aggregateRating"):
        issues = validate_required(
            {"name": "X", "image": "https://x.com/i.jpg", alt: "x"},
            "Product",
            PROD["required"],
            PROD["requiredOneOf"],
        )
        # No "least one of" issue should fire when any alternative is present
        assert not any("least one of" in i["message"] for i in issues), (
            f"oneof issue unexpectedly fired with {alt} present"
        )


def test_none_value_counts_as_missing():
    issues = validate_required(
        {"name": None, "image": "https://x.com/i.jpg", "offers": "https://x.com/o"},
        "Product",
        PROD["required"],
        PROD["requiredOneOf"],
    )
    name_missing = [i for i in issues if i["path"] == "Product.name"]
    assert len(name_missing) == 1


def test_empty_string_counts_as_present():
    issues = validate_required(
        {"name": "", "image": "https://x.com/i.jpg", "offers": "https://x.com/o"},
        "Product",
        PROD["required"],
        PROD["requiredOneOf"],
    )
    assert issues == []

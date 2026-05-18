"""JSON-LD orchestrator integration tests.

Uses the same fixtures the JS suite exercises (copied from
``core/tests/fixtures/``) so a parity drift between the two suites is
visible at this layer too.
"""

from conftest import fixture_text, load_fixture
from schema_audit.validators import validate_jsonld

# ── Valid fixtures should pass ─────────────────────────────────────────────


def test_minimal_product_passes():
    r = validate_jsonld(load_fixture("valid", "minimal-product"))
    assert r["valid"] is True
    assert r["format"] == "jsonld"
    assert r["types"] == ["Product"]
    assert r["errors"] == []


def test_typical_product_passes():
    r = validate_jsonld(load_fixture("valid", "typical-product"))
    assert r["valid"] is True
    assert r["types"] == ["Product"]


def test_product_with_offers_passes():
    r = validate_jsonld(load_fixture("valid", "product-with-offers"))
    assert r["valid"] is True


def test_product_with_review_passes():
    r = validate_jsonld(load_fixture("valid", "product-with-review"))
    assert r["valid"] is True


def test_product_with_inherited_props_passes():
    r = validate_jsonld(load_fixture("valid", "product-with-inherited-props"))
    assert r["valid"] is True


def test_article_passes():
    r = validate_jsonld(load_fixture("valid", "article"))
    assert r["valid"] is True
    assert r["types"] == ["Article"]


def test_news_article_passes():
    r = validate_jsonld(load_fixture("valid", "news-article"))
    assert r["valid"] is True
    assert r["types"] == ["NewsArticle"]


def test_blog_posting_passes():
    r = validate_jsonld(load_fixture("valid", "blog-posting"))
    assert r["valid"] is True
    assert r["types"] == ["BlogPosting"]


def test_person_passes():
    r = validate_jsonld(load_fixture("valid", "person"))
    assert r["valid"] is True
    assert r["types"] == ["Person"]


def test_organization_passes():
    r = validate_jsonld(load_fixture("valid", "organization"))
    assert r["valid"] is True
    assert r["types"] == ["Organization"]


def test_article_full_recommended_zero_warnings():
    r = validate_jsonld(load_fixture("valid", "article-full-recommended"))
    assert r["valid"] is True
    assert r["warnings"] == []


# ── Invalid fixtures should fail with the right code ───────────────────────


def test_missing_context_fixture():
    r = validate_jsonld(load_fixture("invalid", "missing-context"))
    assert r["valid"] is False
    assert any(e["code"] == "MISSING_CONTEXT" for e in r["errors"])


def test_insecure_context_fixture():
    r = validate_jsonld(load_fixture("invalid", "insecure-context"))
    assert r["valid"] is False
    assert any(e["code"] == "INSECURE_CONTEXT" for e in r["errors"])


def test_nonstandard_context_is_warning_not_error():
    r = validate_jsonld(load_fixture("invalid", "nonstandard-context"))
    # NONSTANDARD_CONTEXT is a warning, not an error; the fixture has no
    # other invalidating issue.
    assert any(w["code"] == "NONSTANDARD_CONTEXT" for w in r["warnings"])


def test_missing_type_fixture():
    r = validate_jsonld(load_fixture("invalid", "missing-type"))
    assert r["valid"] is False
    assert any(e["code"] == "MISSING_TYPE" for e in r["errors"])


def test_unknown_type_fixture():
    r = validate_jsonld(load_fixture("invalid", "unknown-type"))
    assert r["valid"] is False
    assert any(e["code"] == "UNKNOWN_TYPE" for e in r["errors"])


def test_unknown_property_fixture():
    r = validate_jsonld(load_fixture("invalid", "unknown-property"))
    assert r["valid"] is False
    assert any(e["code"] == "UNKNOWN_PROPERTY" for e in r["errors"])


def test_invalid_property_value_type_fixture():
    r = validate_jsonld(load_fixture("invalid", "invalid-property-value-type"))
    assert r["valid"] is False
    assert any(e["code"] == "INVALID_PROPERTY_VALUE_TYPE" for e in r["errors"])


def test_invalid_url_fixture():
    r = validate_jsonld(load_fixture("invalid", "invalid-url"))
    assert r["valid"] is False
    assert any(e["code"] == "INVALID_URL" for e in r["errors"])


def test_product_missing_required_name_fixture():
    r = validate_jsonld(load_fixture("invalid", "product-missing-required-name"))
    assert r["valid"] is False
    assert any(
        e["code"] == "MISSING_REQUIRED_PROPERTY" and e["path"] == "Product.name"
        for e in r["errors"]
    )


def test_product_missing_required_oneof_fixture():
    r = validate_jsonld(load_fixture("invalid", "product-missing-required-oneof"))
    assert r["valid"] is False
    one_of = [e for e in r["errors"] if "least one of" in e["message"]]
    assert len(one_of) == 1


def test_product_missing_recommended_brand_is_warning():
    r = validate_jsonld(load_fixture("invalid", "product-missing-recommended-brand"))
    # Recommended-only absences don't invalidate (in non-strict mode).
    assert any(
        w["code"] == "MISSING_RECOMMENDED_PROPERTY" and "brand" in w["path"]
        for w in r["warnings"]
    )


def test_article_unknown_property_fixture():
    r = validate_jsonld(load_fixture("invalid", "article-unknown-property"))
    assert any(e["code"] == "UNKNOWN_PROPERTY" for e in r["errors"])


def test_article_missing_recommended_emits_warnings():
    r = validate_jsonld(load_fixture("invalid", "article-missing-recommended"))
    assert any(w["code"] == "MISSING_RECOMMENDED_PROPERTY" for w in r["warnings"])


# ── String-input parity ────────────────────────────────────────────────────


def test_string_input_parses_and_validates():
    text = fixture_text("valid", "typical-product")
    r = validate_jsonld(text)
    assert r["valid"] is True
    assert r["types"] == ["Product"]


def test_malformed_json_is_parse_error():
    r = validate_jsonld("{not valid json")
    assert r["valid"] is False
    assert r["errors"][0]["code"] == "PARSE_ERROR"


def test_top_level_list_is_parse_error():
    r = validate_jsonld([{"@type": "Product"}])
    assert r["valid"] is False
    assert r["errors"][0]["code"] == "PARSE_ERROR"


# ── Strict mode ────────────────────────────────────────────────────────────


def test_strict_flips_warnings_to_invalid():
    obj = load_fixture("valid", "minimal-product")
    r_loose = validate_jsonld(obj, strict=False)
    r_strict = validate_jsonld(obj, strict=True)
    assert r_loose["valid"] is True
    if r_loose["warnings"]:
        assert r_strict["valid"] is False
    else:
        assert r_strict["valid"] is True


# ── Provenance ─────────────────────────────────────────────────────────────


def test_registry_provenance_fields_present():
    r = validate_jsonld({"@context": "https://schema.org", "@type": "Product"})
    reg = r["registry"]
    assert isinstance(reg["schemaVersion"], str)
    assert isinstance(reg["snapshotAt"], str)
    assert isinstance(reg["curatedRulesVersion"], str)

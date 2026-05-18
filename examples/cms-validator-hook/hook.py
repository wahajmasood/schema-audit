"""cms-validator-hook (Python) — synchronous pre-save validation.

Plug this into your CMS's before_save / before_create signal. Raises
``SchemaInvalid`` on invalid input so the caller's transaction rolls
back; returns the validation result otherwise (callers can log
warnings without blocking).
"""

from __future__ import annotations

from schema_audit import ValidationResult, validate


class SchemaInvalid(Exception):
    """Raised when validation fails — carries the full result for
    inspection / logging by the caller."""

    def __init__(self, result: ValidationResult) -> None:
        codes = ", ".join(
            f"{e['code']}@{e['path'] or '(top)'}" for e in result["errors"]
        )
        super().__init__(f"Schema validation failed: {codes}")
        self.result: ValidationResult = result


def validate_before_save(structured_data: object) -> ValidationResult:
    result = validate(structured_data)
    if not result["valid"]:
        raise SchemaInvalid(result)
    return result


if __name__ == "__main__":
    import sys

    product_draft = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "New Widget",
        "image": "https://example.com/widget.jpg",
        "offers": "https://example.com/widget/buy",
    }
    try:
        r = validate_before_save(product_draft)
        print(f"Saved. {len(r['warnings'])} warnings logged.")
    except SchemaInvalid as err:
        print(f"Rejected: {err}", file=sys.stderr)
        sys.exit(1)

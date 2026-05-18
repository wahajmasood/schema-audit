# schema-audit (Python)

The Python implementation of [schema-audit][repo] — a programmatic
schema-markup validation engine that mirrors **schema.org** structural
rules and **Google Rich Results** eligibility checks with cross-language
parity to the JavaScript package.

> **Status — pre-release (v0.8.0).** JSON-LD only for now. Microdata,
> RDFa, and the Python CLI land in the next release. Not yet on PyPI;
> install from this repo.

**Zero runtime dependencies** — stdlib only.

## Install

Once published to PyPI:

```bash
pip install schema-audit
```

Until then, install from this repository:

```bash
git clone https://github.com/wahajmasood/schema-audit
cd schema-audit/python
pip install .
```

## Usage

```python
from schema_audit import validate

result = validate({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Wireless Earbuds",
    "image": "https://example.com/earbuds.jpg",
    "offers": "https://example.com/offer",
})

if not result["valid"]:
    for err in result["errors"]:
        print(f"{err['code']} at {err['path']}: {err['message']}")
```

`validate()` accepts a JSON string, a `dict`, or a `list`. It always
returns a synchronous result — never throws, never makes a network
call, never reads files outside its own bundled registry data.

## Output shape

Byte-identical to the JavaScript package:

```python
{
    "valid": True,
    "format": "jsonld",
    "types": ["Product"],
    "errors": [],
    "warnings": [],
    "info": [],
    "registry": {
        "schemaVersion": "latest-2026-05",
        "snapshotAt": "2026-05-...",
        "curatedRulesVersion": "google-rich-results-docs-2026-05-16",
    },
}
```

Each issue has the keys `type` (`"error" | "warning" | "info"`), `code`,
`path`, `message`, and `value`.

## Format detection

```python
from schema_audit import detect

detect('{"@context":"https://schema.org","@type":"Product"}')  # → "jsonld"
detect('<div itemscope itemtype="https://schema.org/Product">…')  # → "microdata"
detect('<div vocab="https://schema.org/" typeof="Product">…')   # → "rdfa"
```

> **Note for v0.8.0:** Microdata and RDFa are detected but not yet
> validated by the Python package. Passing those formats to `validate()`
> returns a structured result with code `UNSUPPORTED_FORMAT`. JS already
> supports all three — full Python parity ships in the next release.

## Development

```bash
cd python
pip install -e ".[dev]"
python -m pytest -v          # run test suite
python -m mypy src/schema_audit/   # type check
python -m ruff check src/ tests/   # lint
```

## License

[MIT](../LICENSE) © 2026 wahajmasood.

[repo]: https://github.com/wahajmasood/schema-audit

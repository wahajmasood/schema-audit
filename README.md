# schema-audit

A programmatic schema-markup validation engine — JSON-LD, Microdata, and
RDFa — that mirrors **schema.org** (structural correctness) and
**Google Rich Results** (eligibility) rules with cross-language parity
and zero runtime dependencies. Drop it into any application that needs
to validate structured data: page auditors, SEO platforms, CMSes,
content monitors, AI agents.

> **Status — pre-release (v0.9.0).** **Full parity** between
> JavaScript and Python. Both ship JSON-LD + Microdata + RDFa
> validation, the same `schema-audit` CLI binary, and the same
> output shape. The cross-language conformance corpus
> (`tests/conformance/`) makes the parity a test-enforced invariant.
>
> Available as a JS library, JS CLI binary, Python library, and
> Python CLI binary — same surface area, same verdicts.
> Two-layer validation:
> - **Layer 1** (schema.org structural) for 28 types — auto-synced
>   from schema.org's canonical JSON-LD (`Thing`, `CreativeWork`,
>   `Article`, `SocialMediaPosting`, `NewsArticle`, `BlogPosting`,
>   `Person`, `Organization`, `Product`, `Book`, `Movie`,
>   `MusicRecording`, `HowTo`, `Recipe`, `Review`, `WebSite`,
>   `WebPage`, `FAQPage`, `SoftwareApplication`, `Course`,
>   `MediaObject`, `VideoObject`, `Event`, `Place`, `Intangible`,
>   `ItemList`, `BreadcrumbList`, `JobPosting`).
> - **Layer 2** (Google Rich Results required + recommended-property
>   checks) for 4 types: `Product` (required: name + image + one of
>   offers/review/aggregateRating; plus recommended), `Article`,
>   `NewsArticle`, `BlogPosting` (recommended only).
>
> Microdata, RDFa, additional schema types, and the Python package
> land in later cycles. See the roadmap below.

## Install

JavaScript:

```bash
npm install schema-audit
```

Python:

```bash
pip install schema-audit
```

Neither package is on its public registry yet — install from this repo
until v1.0:

```bash
# JS (from a local clone)
cd schema-audit/core && npm install && npm run build
# Python
cd schema-audit/python && pip install .
```

## CLI

After install, the `schema-audit` binary is on your PATH:

```bash
# Validate a file (auto-detects format)
schema-audit validate ./page.html
schema-audit ./product.json              # validate is implicit

# Pipe from stdin
curl -s https://example.com/page | schema-audit

# Just detect the format
schema-audit detect ./page.html          # prints: microdata

# JSON output for CI / tooling
schema-audit validate --json ./page.html

# Strict mode (warnings → exit 1)
schema-audit validate --strict ./product.json
```

Exit codes: `0` valid, `1` invalid (errors present, or warnings under
`--strict`), `2` usage error.

## Library usage

JavaScript:

```js
import { validate } from "schema-audit";

const result = validate({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Wireless Earbuds",
  url: "https://example.com/products/earbuds",
});

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.code} at ${err.path}: ${err.message}`);
  }
}
```

Python:

```python
from schema_audit import validate

result = validate({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Wireless Earbuds",
    "url": "https://example.com/products/earbuds",
})

if not result["valid"]:
    for err in result["errors"]:
        print(f"{err['code']} at {err['path']}: {err['message']}")
```

`validate()` accepts either a raw JSON string or an already-parsed
object/dict, and always returns a synchronous result — never throws,
never makes a network call.

## Output shape

```json
{
  "valid": true,
  "format": "jsonld",
  "types": ["Product"],
  "errors": [],
  "warnings": [],
  "info": [],
  "registry": {
    "schemaVersion": "latest-2026-05",
    "snapshotAt": "2026-05-15T14:37:13.297Z"
  }
}
```

Each issue (in `errors`, `warnings`, or `info`) has:

```ts
interface Issue {
  type: "error" | "warning" | "info";
  code: string;    // e.g. "MISSING_REQUIRED_PROPERTY"
  path: string;    // e.g. "Product.name" or "@context"
  message: string;
  value: unknown;
}
```

## What this is — and what it isn't

**Is:** a single-purpose validation engine. Drop in a library, pass in
markup, get back a structured verdict.

**Is not:** a UI tool, a web server, a database, a Chrome extension, or a
scraper. Validation is a pure function of input + the bundled registry.
No network calls. No subprocesses. No fetching remote `@context`s.

## Cycle 1 scope (this release)

- ✅ JSON-LD validation for **Product**, **Article**, **NewsArticle**,
  **BlogPosting**, **Person**, **Organization** (plus their inherited
  `Thing` and `CreativeWork` properties)
- ✅ **Layer 1** — schema.org structural rules (existence, value-type,
  URL format, 4-level inheritance chains pre-flattened)
- ✅ **Layer 2** — Google Rich Results required + recommended-property
  checks for Product / Article / NewsArticle / BlogPosting
- ✅ Output-shape contract locked across future JS + Python releases
- ✅ TypeScript source → dual ESM + CJS + `.d.ts`
- ✅ **Corpus + snapshot regression suite** — 15 production-shaped
  samples with committed golden snapshots; CI fails on any unintended
  validator-output drift (`npm run corpus`)
- ✅ **Heterogeneous-input benchmark** measuring throughput across
  diverse inputs (`npm run bench:corpus`) — currently 1.32 µs/op
  average; see `core/bench/BASELINE.md` for caveats
- ✅ **Microdata** (HTML5 `itemscope`/`itemtype`/`itemprop`) — parsed via the one allowed runtime dep, `parse5`
- ✅ **RDFa** (HTML `vocab`/`typeof`/`property`) — same parse5 pipeline; CURIE prefixes not yet supported
- ⛔ Layer 2 for additional types (Person, Organization, Recipe, Event,
  LocalBusiness, JobPosting, …) — later cycles
- ⛔ Offer / Review object-shape validation (e.g., `offers` must contain
  `price` + `priceCurrency`) — cycle 4 or 5
- ⛔ Schema types beyond the 8 above — cycle 5 (auto-sync)
- ⛔ Python package — cycle 9
- ⛔ CLI wrapper — cycle 8
- ⛔ Auto-sync from schema.org — cycle 5

## License

[MIT](./LICENSE) © 2026 wahajmasood.

## References

- [schema.org documentation](https://schema.org/)
- [Google Search structured-data documentation](https://developers.google.com/search/docs/appearance/structured-data)
- [JSON-LD 1.1 specification](https://www.w3.org/TR/json-ld11/)

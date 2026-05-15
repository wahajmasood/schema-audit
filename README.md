# schema-audit

A programmatic schema-markup validation engine — JSON-LD, Microdata, and
RDFa — that mirrors **schema.org** (structural correctness) and
**Google Rich Results** (eligibility) rules with cross-language parity
and zero runtime dependencies. Drop it into any application that needs
to validate structured data: page auditors, SEO platforms, CMSes,
content monitors, AI agents.

> **Status — pre-release (v0.1.0).** Cycle 1 ships a JavaScript-only,
> JSON-LD-only, Layer-1-only (schema.org structural) validator for the
> `Product` type. Microdata, RDFa, Layer 2 (Google Rich Results required
> properties), additional schema types, and the Python package land in
> later cycles. See the roadmap below.

## Install

```bash
npm install schema-audit
```

Cycle 1 is not yet published to npm; install from this repo's tarball
once a release lands.

## Usage

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

`validate()` accepts either a raw JSON string or an already-parsed
object, and always returns a synchronous result — never throws, never
makes a network call.

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

- ✅ JSON-LD validation for **Product** (and its inherited Thing properties)
- ✅ schema.org **structural** rules (existence, value-type, URL format)
- ✅ Output-shape contract locked across future JS + Python releases
- ✅ TypeScript source → dual ESM + CJS + `.d.ts`
- ⛔ Microdata / RDFa — cycle 6/7
- ⛔ Google Rich Results required-property checks — cycle 3
- ⛔ Other schema types beyond Product — cycles 2 onward
- ⛔ Python package — cycle 9
- ⛔ CLI wrapper — cycle 8
- ⛔ Auto-sync from schema.org — cycle 5

## License

[MIT](./LICENSE) © 2026 wahajmasood.

## References

- [schema.org documentation](https://schema.org/)
- [Google Search structured-data documentation](https://developers.google.com/search/docs/appearance/structured-data)
- [JSON-LD 1.1 specification](https://www.w3.org/TR/json-ld11/)

# Cross-language conformance corpus

This directory is the structural-parity guarantee between the JavaScript
and Python implementations. Each `<name>.input.json` is paired with a
`<name>.golden.json` — the **normalized expected output**. Both test
suites assert that

```
normalize(validate(input)) == golden
```

If JS and Python ever disagree on a fixture, one of the two suites will
fail on the next CI run. Parity is enforced; it isn't documentation.

## Normalization

`registry.snapshotAt` is replaced with the literal string `"<NORMALIZED>"`
because the timestamp regenerates every build. All other fields are
asserted exactly, including key order under `json.dumps(sort_keys=True)` /
`JSON.stringify` after deep sort.

## Regenerating goldens

When a behavior change is intentional, regenerate from either runtime
and verify the OTHER runtime also matches:

```bash
node scripts/regen-conformance.mjs       # writes goldens from JS validator
cd python && python -m pytest tests/test_conformance.py   # must still pass
```

If Python fails after regen, the implementations have diverged — fix
the bug, then regen again.

## Inputs

- `valid-product` — minimal valid Product (1 type, 0 errors, 0 warnings)
- `valid-article` — Article with all required + recommended properties
- `invalid-product-oneof` — Product missing offers/review/aggregateRating
- `invalid-product-recommended` — valid Product missing recommended properties
- `missing-context` — JSON-LD without `@context`
- `insecure-context` — `@context: "http://schema.org"` (Layer 1 error)
- `unknown-type` — `@type` not in the registry
- `invalid-url-value` — `url` property with a non-URL string
- `unknown-property` — property not on the type or its ancestors
- `news-article-warnings` — NewsArticle missing some recommended properties

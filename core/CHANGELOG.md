# Changelog

All notable changes to the `schema-audit` JavaScript package will be
documented in this file. The format is based on [Keep a Changelog]
(https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-05-16

SDD cycle `accuracy-corpus-harness`. Operational infrastructure
— no new validator features, no public-API surface change. Ships
the corpus + snapshot framework, heterogeneous-input benchmark,
and a manually-maintained Google-truth canary subset that the
constitution promised in cycle 4.

### Added

- `core/tests/corpus/` — 15 production-shaped JSON-LD samples
  covering Product / Article family / Person / Organization with
  realistic property variation, including 2 samples that embed
  inline Person and Organization values.
- `core/tests/corpus/snapshots/` — committed golden output per
  sample, normalized to strip non-deterministic registry fields
  (`snapshotAt`, `schemaVersion`, `curatedRulesVersion`).
- `core/tests/corpus.test.ts` — snapshot regression suite. Fails
  CI on any unintended change in validator output for any
  corpus sample.
- `core/scripts/regen-corpus-snapshots.mjs` — snapshot
  regenerator. Run via `npm run corpus:regen` after intentional
  behavior changes. Idempotent — running twice produces no diff.
- `core/tests/google-truth.json` + `google-truth.test.ts` —
  manually-maintained expected Google Rich Results Test verdicts
  for 5 corpus samples. Diagnostic-only (CI doesn't fail) so the
  project stays honest about drift between schema-audit's output
  and Google's without rigging snapshots.
- `core/bench/bench-corpus.js` — heterogeneous-input benchmark
  iterating the full corpus. The "production-shaped" number
  `BASELINE.md` said was coming in this cycle.
- `core/bench/BASELINE.md` — new "v0.3.1 — Heterogeneous-input
  baseline" section: 759,176 ops/sec across 150,000 validations,
  1.32 µs/op average. ~6× spread between fastest sample (Person
  minimal, 0.36 µs) and slowest (Product minimal, 2.04 µs).
- npm scripts: `corpus`, `corpus:regen`, `bench:corpus`.

### Changed

- `core/scripts/run-tests.js` — accepts optional positional
  filename patterns (so the `corpus` script can run just
  `corpus.test.ts` + `google-truth.test.ts`).

### What this does NOT do

- It does NOT automate diffing against Google's Rich Results Test
  (Google has no public API). The canary is manually maintained;
  divergences surface as test diagnostics during weekly governance
  reviews.
- It does NOT add headless-browser scraping of Rich Results Test
  (decided against — too fragile, ToS-questionable).
- It does NOT add CI perf-regression gating yet (numbers stay
  informational until CI infrastructure exists, cycle 8+).

### Test status

- 112 → **133 / 133 pass** (+21 cycle-4 tests: 15 snapshot tests +
  1 well-formedness check + 5 canary tests).
- Coverage on `core/src/`: 99.49% lines, 97.97% branches, 97.37%
  functions.

### Dependencies

- Runtime: zero (unchanged).
- Dev: unchanged.

[0.3.1]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.3.1

## [0.3.0] — 2026-05-16

SDD cycle `jsonld-rich-results-l2`. Adds **Layer 2** — Google Rich
Results required + recommended-property checks — on top of the
schema.org structural Layer 1 from cycles 1+2. This is the
differentiator the constitution promised.

### Added

- **Curated rules file** — `core/registry/curated-rules.json`.
  Manually maintained from Google's Rich Results documentation per
  the constitution. Inlined at build time. Provenance:
  `sourceVersion` + `snapshotAt`.
- **Two new atomic rules**:
  - `validateRequired(obj, typeName, required, requiredOneOf)` —
    handles both simple required and `requiredOneOf` groups.
  - `validateRecommended(obj, typeName, recommended)` — warning per
    missing recommended property.
- **Two new error codes**:
  - `MISSING_REQUIRED_PROPERTY` (error) — covers simple missing AND
    unsatisfied `requiredOneOf`. Path is `"<Type>.<prop>"` for
    simple, `"<Type>"` for oneOf with alternatives named in
    `message`.
  - `MISSING_RECOMMENDED_PROPERTY` (warning).
- **Layer 2 coverage in cycle 3**:
  - `Product` — required: `name`, `image`; oneOf: `[offers, review,
    aggregateRating]`; recommended: brand, sku, gtin, description,
    mpn, audience
  - `Article`, `NewsArticle`, `BlogPosting` — recommended only
    (no strict required per current Google docs); see
    `curated-rules.json` for the per-type set.
- **Curated-rules loader** — `core/src/curated-rules.ts` mirrors
  `registry.ts`: `loadCuratedRules()`, `getCuratedRules(name)`.
  Returns `undefined` for types without entries (Person,
  Organization, anything else) — orchestrator silently skips
  Layer 2 for those.
- **5 new fixtures + 4 new test files** — 37 new test cases.

### Changed

- **`ValidationResult.registry` extended** (additive) with
  `curatedRulesVersion: string`. Minor version bump per Design
  Tenet #5.
- **Product registry expanded** in `scripts/cycle1-types.json` with
  `offers`, `review`, `aggregateRating`, `mpn`, `audience`. These
  were missing from cycle 1's hand-curated source; cycle 3 needs
  them for Layer 2 to reference. Registry now has 15 Product
  properties (was 10).
- **Cycle-1 fixtures updated** to satisfy Layer 2 (added `image`
  and/or `offers` where missing). Post-0.3.0, "valid Product" means
  satisfying schema.org structural AND Google Rich Results
  eligibility.
- **Bundle size:** `dist/index.js` grew from ~22 KB to ~27 KB with
  the curated-rules JSON inlined.
- **Bench drift:** `validate(parsedInput)` now 1.79 µs/op (was 1.40
  in v0.2.0). Layer 2 adds property-presence iteration on types with
  curated entries. Still well within the constitution's working
  target. See `bench/BASELINE.md` for what these numbers do and
  don't support.

### Test status

- **112 / 112 tests pass** (75 → 112; +37 Layer-2 tests).
- Coverage on `core/src/`: 99.71% lines, 99.07% branches, 97.25%
  functions.

### Known limitations (carried + new)

- Layer 2 covers 4 types only (Product, Article, NewsArticle,
  BlogPosting). Person, Organization, Recipe, Event, Review,
  LocalBusiness, JobPosting, FAQPage, BreadcrumbList, VideoObject,
  etc. arrive in later cycles.
- Layer 2 checks property *presence* only. The Offer object's
  internal shape (price + priceCurrency) is not yet validated —
  cycle 4 or 5 candidate.
- Date format validation (`INVALID_DATE_FORMAT`) still deferred —
  strings continue to pass for Date-typed properties.
- `@context` only handled as a string; object/array forms still
  deferred.
- Microdata / RDFa / Python / CLI / auto-sync — per roadmap.

### Dependencies

- Runtime: zero.
- Dev: unchanged from v0.2.0.

[0.3.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.3.0

## [0.2.0] — 2026-05-16

SDD cycle `jsonld-multi-type-l1`. Additive cycle — extends the
registry from 2 types to 8 with **zero `core/src/` code changes**.
Demonstrates that the cycle-1 architecture (registry-driven, atomic
rules, pre-flattened inheritance) scales as data, not code.

### Added

- **6 new schema types** in the registry:
  - `CreativeWork` (extends `Thing`) — author, datePublished,
    dateModified, headline, publisher, about, inLanguage
  - `Article` (extends `CreativeWork`) — articleBody, articleSection,
    wordCount
  - `NewsArticle` (extends `Article`) — dateline, printSection.
    4-level inheritance chain: NewsArticle → Article → CreativeWork
    → Thing.
  - `BlogPosting` (extends `Article`) — no own properties; pure
    inheritance test case.
  - `Person` (extends `Thing`) — givenName, familyName, jobTitle,
    email, telephone, worksFor, affiliation
  - `Organization` (extends `Thing`) — legalName, founder,
    foundingDate, email, telephone, numberOfEmployees
- 6 new test fixtures (5 valid + 1 invalid) covering the new types.
- 13 new tests (6 registry-shape assertions + 7 Given/When/Then
  scenarios from the spec-delta).

### Changed

- Bundle size: `dist/index.js` grew from ~10 KB to ~22 KB due to the
  larger inlined registry.
- Benchmark drift: validate(parsedInput) now 1.40 µs/op (was 1.29 in
  cycle 1) — a small slowdown from iterating more properties on
  larger types. Still well within the constitution's working target.
  See `bench/BASELINE.md` for what this number does and does not
  support.

### Unchanged (deliberately)

- `core/src/` had no logic changes — only the `VERSION` constant
  was bumped. The architectural promise that adding types is "data,
  not code" held.
- Public API surface, output shape, error codes, atomic-rule
  contracts: all identical to v0.1.0.

### Test status

- **75 / 75 tests pass.**
- Coverage on `core/src/`: 99.86% lines, 99.14% branches, 97.97%
  functions.

### Known limitations (carried from v0.1.0)

- JSON-LD only — Microdata and RDFa in cycles 6 / 7.
- Layer 2 (Google Rich Results required/recommended-property checks)
  not yet shipped — cycle 3.
- `@context` only handled as a string; object/array forms deferred.
- Multi-typed entities (`@type: ["Article", "BlogPosting"]`) not
  yet supported.
- No CLI yet — library only.
- Schema types beyond the 8 in the registry are not yet covered.
  Cycle 5 will auto-sync all schema.org types.

### Dependencies

- Runtime: zero.
- Dev: unchanged from v0.1.0.

[0.2.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.2.0

## [0.1.0] — 2026-05-15

Foundational release — SDD cycle `jsonld-product-l1`. Establishes the
package skeleton, registry shape, output-shape contract, atomic-rule
pattern, and test pattern that all later cycles will extend.

### Added

- **Public API.** `validate(input, options?)` accepting a raw JSON
  string or a parsed object; returns a `ValidationResult` synchronously.
  Never throws, never makes I/O.
- **Output contract** (locked across future JS + Python releases):
  `ValidationResult { valid, format, types, errors[], warnings[],
  info[], registry: { schemaVersion, snapshotAt } }`.
- **Issue contract:** every issue carries `type`, `code`, `path`,
  `message`, `value`.
- **Error codes** (10, all UPPER_SNAKE_CASE):
  `PARSE_ERROR`, `UNKNOWN_FORMAT`, `MISSING_CONTEXT`, `INSECURE_CONTEXT`,
  `NONSTANDARD_CONTEXT`, `MISSING_TYPE`, `UNKNOWN_TYPE`,
  `UNKNOWN_PROPERTY`, `INVALID_PROPERTY_VALUE_TYPE`, `INVALID_URL`.
- **Registry.** `Thing` and `Product` schema.org types, pre-flattened
  inheritance chains at build time (zero parent-walking at runtime).
- **Atomic rules** (pure functions, no I/O, no shared state):
  `validateContext`, `validateType`, `validatePropertyExistence`,
  `validatePropertyValueType`, `validateUrl`.
- **JSON-LD orchestrator** that wires the rules together in a single
  synchronous pass.
- **Dual build:** ESM + CJS + `.d.ts` from TypeScript source via `tsup`.
- **Test suite:** 62 tests across 12 suites covering all 12
  Given/When/Then scenarios from the spec-delta. Coverage on
  `core/src/`: 99.78% lines, 98.10% branches, 98.39% functions.
- **Benchmark:** baseline numbers on Node v22.18.0 / linux x64 in
  `bench/BASELINE.md`. Working target was < 1 ms per validate. Under
  best-case micro-benchmark conditions (same input, hot JIT, hot
  cache, no concurrent load) we measured 2.18 µs/op for string input
  and 1.29 µs/op for object input. **These are not production
  throughput guarantees** — see BASELINE.md for what the numbers do
  and do not support. The production-shaped perf harness lands in
  cycle 4.

### Known limitations

- JSON-LD only — Microdata and RDFa land in later cycles.
- Only `Thing` and `Product` types in the registry — additional types
  arrive in cycle 2 onward.
- Layer 2 (Google Rich Results required/recommended properties) not yet
  shipped — cycle 3.
- `@context` only handled as a string. Object and array forms
  (`{"@context": {...}}` or `["..."]`) are not yet supported.
- Multi-typed entities (`@type: ["Article", "BlogPosting"]`) not yet
  supported — single string `@type` only.
- Remote `@context` URLs are never fetched or resolved. We never make
  network calls during validation.
- No CLI yet — invoke via library only.

### Dependencies

- **Runtime:** zero.
- **Dev:** `tsup`, `tsx`, `typescript`, `@types/node`.

[0.1.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.1.0

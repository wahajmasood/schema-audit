# Changelog

All notable changes to the `schema-audit` JavaScript package will be
documented in this file. The format is based on [Keep a Changelog]
(https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

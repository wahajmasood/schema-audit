# Changelog

All notable changes to the `schema-audit` JavaScript package will be
documented in this file. The format is based on [Keep a Changelog]
(https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  `bench/BASELINE.md`. Working target was < 1 ms per validate; we are at
  2.18 µs (string input) and 1.29 µs (object input).

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

# Changelog

All notable changes to the `schema-audit` JavaScript package will be
documented in this file. The format is based on [Keep a Changelog]
(https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] — 2026-05-18

SDD cycle `cli-wrapper`. Small DX cycle. Adds a thin command-line
binary (`schema-audit`) that wraps the existing `validate()` and
`detect()` functions. No new validator logic; no new runtime dep.

### Added

- **`schema-audit` binary** — installed when consumers run
  `npm install schema-audit`. Surface:
  ```
  schema-audit [validate] [file] [options]
  schema-audit detect [file]
  schema-audit --version
  schema-audit --help
  ```
  Input from a file path, `-` (stdin), or omitted (stdin).
- **Flags**:
  - `--format <fmt>` — override auto-detect
    (`auto` | `jsonld` | `microdata` | `rdfa`)
  - `--strict` — treat warnings as errors
  - `--json` — full `ValidationResult` as JSON
  - `-h` / `--help`, `-v` / `--version`
- **Exit codes**: 0 valid, 1 invalid, 2 usage / read error.
- **`core/src/cli.ts`** — `runCli({ argv, stdin, stdout, stderr,
  readFile? }): Promise<number>`. Pure function with injected I/O,
  testable without spawning child processes.
- **`core/src/cli/render.ts`** — `renderHuman(result, opts)`
  produces the human-readable output. Tested in isolation.
- **`core/bin/schema-audit.js`** — ~10-line shebang launcher that
  imports `runCli` from the built artifact.

### Changed

- **`tsup.config.ts`** — adds `src/cli.ts` as a second entry.
  Produces `dist/cli.js` and `dist/cli.cjs` alongside the existing
  `dist/index.*`.
- **`core/package.json`**:
  - `bin: { "schema-audit": "./bin/schema-audit.js" }`
  - `files` includes `bin`
  - `engines.node` raised from `>=18` to `>=18.4` (`util.parseArgs`
    needs 18.4+)
- **`core/src/index.ts`** — VERSION 0.6.0 → 0.7.0.

### Test status

- 209 → **231 / 231 pass** (+22 cycle-8 tests: 12 CLI scenarios +
  6 render cases + a few coverage tests).
- Coverage on `core/src/`: 99.84% lines, 94.26% branches, 98.20%
  functions.

### Bundle size

- `dist/index.js` ~469 KB (up slightly from 452 KB — minor type
  graph growth).
- `dist/cli.js` ~474 KB (the CLI bundles its own copy of the
  library; cycle 11 / release prep is the right time to deduplicate
  via code splitting if needed).
- Total package install size grows by parse5 + the CLI bundle.

### What this does NOT do

- **URL fetching** (`schema-audit validate https://example.com`) —
  out of scope; would add `fetch` semantics, redirects, timeouts.
- **Color output** — uncolored works everywhere; defer.
- **Watch mode** (`--watch file.html`) — niche; defer.
- **Glob patterns** (`schema-audit validate "pages/**/*.html"`) —
  the shell expands globs; the CLI handles one input at a time.
- **Configuration files** (`.schema-auditrc`) — not needed yet.

### Dependencies

- **Runtime**: `parse5` ^7.0.0 (unchanged).
- **Dev**: unchanged.

[0.7.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.7.0

## [0.6.0] — 2026-05-18

SDD cycle `rdfa-validator`. Adds **RDFa** as the third input
format. Smallest substantive cycle so far — the per-item engine
(cycle 6's foundation refactor) and parse5 (cycle 6's runtime dep)
absorbed RDFa with minimal additional surface area.

### Added

- **`core/src/utils/rdfa-extractor.ts`** — parses HTML via parse5
  and extracts RDFa items. Top-down vocab inheritance: as we
  recurse, we track the "current vocab" from ancestors. When we
  hit a `[typeof]` element, we resolve the bare type name against
  the inherited vocab. Fully-qualified schema.org URLs (e.g.,
  `typeof="https://schema.org/Product"`) work without an ancestor
  vocab.
- **`core/src/validators/rdfa.ts`** — orchestrator. Same shape as
  `microdata.ts`. Delegates per-item to `per-item.ts`. Multi-item
  documents get `<Type>[<index>]` path prefixes.
- **1 new error code**: `NO_VOCAB` (element has `typeof` but no
  ancestor `[vocab]` and `typeof` isn't a fully-qualified schema.org
  URL). Total codes: 15 → **16**.
- **5 new HTML fixtures** plus 12 Given/When/Then scenarios in
  `validate-rdfa.test.ts`, and 16 extractor unit tests.
- **Corpus extension**: 2 new HTML samples (`rdfa-product.html`,
  `rdfa-article.html`) with golden snapshots. Corpus: 20 → 22
  samples.

### Changed

- **`ValidateOptions.format`** widens to
  `"auto" | "jsonld" | "microdata" | "rdfa"`. All three formats
  are now publicly supported via explicit `format` or auto-detect.
- **`validate(input, options?)`** dispatches RDFa when the resolved
  format is `"rdfa"`. Object inputs still always go to the JSON-LD
  pipeline.

### Test status

- 179 → **209 / 209 pass** (+28 cycle-7 tests + 2 corpus snapshots).
- Coverage on `core/src/`: ≥ 99%.

### Bundle size

- ESM: ~452 KB (essentially unchanged from cycle 6's 451 KB — the
  new code is ~270 lines added).

### What this does NOT do

- **No CURIE prefix support** (`typeof="schema:Product"` with
  `prefix="schema: https://schema.org/"`) — rare in practice for
  schema.org markup. The validator emits `INVALID_ITEMTYPE` with
  a message naming the limitation. Future cycle if real users ask.
- **No `NONSTANDARD_VOCAB` warning** for non-schema.org vocab —
  silently produces no items.
- **No `jsonld-embedded` extraction** still — separate format, its
  own future cycle.

### Dependencies

- **Runtime**: `parse5` ^7.0.0 (unchanged — same dep as cycle 6).
- **Dev**: unchanged.

[0.6.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.6.0

## [0.5.0] — 2026-05-18

SDD cycle `microdata-validator`. Adds **Microdata** as a second
input format — the first format beyond JSON-LD. Exercises
`principles.md`'s "one named exception" allowance for an HTML parser
and validates the architectural promise that adding formats is
additive on top of the existing rule engine.

### Added

- **One runtime dependency**: `parse5` ^7.0.0 — spec-compliant HTML
  parser; used by jsdom. `npm ls --omit=dev` now shows: `parse5@7.3.0`
  (one entry; no transitive runtime deps).
- **`core/src/utils/detector.ts`** — `detect(input)` auto-classifies
  input as `jsonld` / `microdata` / `rdfa` (cycle 7) / `unknown`.
  Substring sniffing; pure; fast.
- **`core/src/utils/microdata-extractor.ts`** — parses HTML via
  parse5, walks the tree, extracts top-level `[itemscope]` items
  into JSON-LD-shaped objects. Handles per-element value rules:
  `meta`→content, `a`/`link`→href, `img`/`audio`/`video`/etc.→src,
  `time`→datetime, `data`/`meter`→value, others→textContent.
  Nested itemscope yields nested objects. Multi-valued itemprop
  attaches the same value to each name.
- **`core/src/validators/microdata.ts`** — orchestrator. Runs the
  extractor, delegates per-item validation to the shared
  `per-item.ts` engine, aggregates issues, prefixes paths with
  `<Type>[<index>]` when multiple items share a type.
- **3 new error codes** + factories:
  - `NO_ITEMSCOPE` (error) — element has `itemtype` but no `itemscope`
  - `MISSING_ITEMTYPE` (error) — top-level `[itemscope]` without `itemtype`
  - `INVALID_ITEMTYPE` (error) — itemtype URL doesn't parse, isn't
    schema.org, or references an unknown type
- **`core/src/validators/per-item.ts`** — extracted from
  `validators/jsonld.ts` last cycle as foundation for this one.
  Shared by both JSON-LD and Microdata orchestrators.
- **6 new HTML fixtures** under `core/tests/fixtures/` (valid +
  invalid) plus 12 Given/When/Then scenarios in
  `validate-microdata.test.ts`.
- **Corpus extension**: 2 new HTML samples
  (`microdata-product.html`, `microdata-article.html`) with golden
  snapshots. Corpus + regen scripts updated to handle `.html`
  files alongside `.json`.
- **Public `detect()` export** so callers can pre-classify input
  without invoking the full validator.

### Changed

- **`ValidateOptions.format`** widened from `"auto" | "jsonld"` to
  `"auto" | "jsonld" | "microdata"`. RDFa arrives in cycle 7.
- **`validate(input, options?)`** now dispatches based on resolved
  format (auto-detect or explicit). Object inputs still always go
  to the JSON-LD pipeline (Microdata requires HTML strings).
- **Detector** also treats `itemtype` alone (without `itemscope`)
  as a Microdata signal — so broken markup routes to the right
  pipeline and surfaces `NO_ITEMSCOPE` instead of `UNKNOWN_FORMAT`.

### Test status

- 136 → **179 / 179 pass** (+43 cycle-6 tests: 14 detector + 15
  extractor + 12 validator scenarios + 2 corpus snapshots).
- Coverage on `core/src/`: 99.89% lines, 95.90% branches, 98.15%
  functions.

### Performance

- Heterogeneous bench (now 20 corpus samples incl. 2 HTML):
  **1.37 µs/op** (vs cycle-5's 1.46 µs/op single-format).
- Microdata-specific samples in the corpus run through parse5; per-
  sample times are still in the 1–3 µs range. parse5 is fast.
- Slowest sample: `recipe` (JSON; many properties), 2.21 µs/op.
  Fastest: `person-minimal`, 0.33 µs/op.

### Bundle size

- ESM: ~451 KB (essentially unchanged from cycle 5's 451 KB —
  parse5 ships outside the bundle as a runtime dep; the bundle
  only carries our code + the inlined registry).
- npm install size grows by parse5's footprint (~80 KB unpacked).

### What this does NOT do

- **No `jsonld-embedded` extraction** (pulling JSON-LD from
  `<script type="application/ld+json">` tags). Different
  extraction logic; ships in its own small next cycle.
- **No RDFa** — cycle 7.
- **No `itemref` attribute support** — rare in practice; documented
  as a known limitation.
- **No DOM abstraction exported** — parse5 is internal; not
  re-exported.

### Dependencies

- **Runtime**: `parse5` ^7.0.0 (the one allowed exception per
  principles.md).
- **Dev**: unchanged.

[0.5.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.5.0

## [0.4.0] — 2026-05-16

SDD cycle `schema-org-auto-sync`. Replaces the hand-curated registry
source with auto-extracted data from schema.org's canonical JSON-LD
graph for a curated allowlist of 28 types. Type coverage expands
from 8 → 28; bundle size grows accordingly.

### Added

- **`scripts/sync-schema.mjs`** — fetches
  `https://schema.org/version/latest/schemaorg-current-https.jsonld`,
  parses the @graph, inverts the property→domain model into our
  type→properties shape, and writes `scripts/source-types.json`.
  Zero runtime deps (Node ≥ 18 native fetch). Cache at
  `scripts/.schemaorg-cache.jsonld` (gitignored); `--no-cache`
  forces re-fetch.
- **Type allowlist** of 28 entries (was 8 in cycle 4): added
  `Book`, `Movie`, `MusicRecording`, `HowTo`, `Recipe`, `Review`,
  `WebSite`, `WebPage`, `FAQPage`, `SoftwareApplication`,
  `Course`, `MediaObject`, `VideoObject`, `Event`, `Place`,
  `Intangible`, `ItemList`, `BreadcrumbList`, `JobPosting`, plus
  `SocialMediaPosting` as the canonical intermediate parent of
  `BlogPosting`.
- **Three new corpus samples**: `recipe.json`, `event.json`,
  `job-posting.json` — committed with golden snapshots.
- **npm scripts**: `sync-schema`, `sync:force`, `sync` (composite).
- **Multi-parent reporting** — sync script logs which alternate
  parents it dropped when a schema.org type has multi-parent
  inheritance and only one is in the allowlist (e.g., Course
  extends both LearningResource and CreativeWork; we keep
  CreativeWork).

### Changed

- **Property counts per type expanded substantially.** Cycle 2's
  hand-curated `Article` had 3 own properties; schema.org's
  canonical Article has many more (articleBody, articleSection,
  wordCount, pageStart, pageEnd, speakable, backstory, etc.).
- **Bundle size: 27 KB → 451 KB** (17× growth). Most of the growth
  is the inlined registry JSON. Still well within "small npm
  package" territory; flagged for revisit if all-800-types
  expansion happens in a future cycle (which would necessitate
  runtime parent-walking to keep bundle reasonable).
- **Bench drift: 1.32 → 1.46 µs/op** (heterogeneous, parsed input).
  Per-property iteration is slightly slower over the larger
  flattened `allProperties` map. Still well under target.
- **`scripts/cycle1-types.json` renamed to `scripts/source-types.json`**
  via `git mv` (history preserved). Filename was misleading after
  cycle 2; rename was overdue.
- **`Organization.numberOfEmployees` value-type** changed from
  `Integer` (cycle-2 hand-curated, incorrect per schema.org) to
  `QuantitativeValue` (canonical). Cycle-2 fixtures using
  `numberOfEmployees: 250` were updated to the canonical object
  shape `{ "@type": "QuantitativeValue", "value": 250 }`.
- **`BlogPosting.parents`** chain now includes
  `SocialMediaPosting` as the canonical intermediate
  (was `["Article", "CreativeWork", "Thing"]`; now
  `["SocialMediaPosting", "Article", "CreativeWork", "Thing"]`).
- **Cycle-2 registry tests** loosened to assert structural facts
  (parents chain, presence of representative properties) rather
  than exact property counts. The auto-synced source produces
  many more properties than the hand-curated cycle-2 source had.

### What this does NOT do

- **Not all 800+ schema.org types.** The allowlist is 28. The
  full-coverage version is a future cycle that pairs with a
  runtime parent-walking architecture change to keep bundle size
  manageable.
- **No multi-parent inheritance** (e.g., `LocalBusiness` extends
  both `Organization` and `Place`). Sync script rejects allowlist
  entries with multiple in-allowlist parents; defers `LocalBusiness`
  and friends to the same future cycle.
- **No GitHub Action weekly automation**. Sync is run manually
  via `npm run sync` per governance.md's weekly cadence. Automation
  ships when CI infra lands (cycle 8+).
- **No Layer-2 curated rules for the new types.** Recipe, Event,
  JobPosting etc. validate at Layer 1 only. Layer-2 rules for
  these arrive in a future cycle (manual Google docs reading
  required).

### Test status

- 133 → **136 / 136 pass** (+3 new corpus samples for Recipe,
  Event, JobPosting).
- Coverage on `core/src/`: 99.93% lines, 97.97% branches, 97.37%
  functions.

### Dependencies

- Runtime: zero (unchanged).
- Dev: unchanged.

[0.4.0]: https://github.com/wahajmasood/schema-audit/releases/tag/v0.4.0

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

# Cycle 1 Baseline Benchmark

> Informational baseline only. There is no CI regression gate in cycle 1.
> The gate (fail CI on ≥20% slowdown) will be added in a later cycle once
> baselines have been measured on multiple machines.

## Methodology

- **Fixture:** `core/tests/fixtures/valid/typical-product.json` — a
  representative Product with 8 properties (mix of own + inherited,
  with a URL value, an inherited URL via `image`, and a string
  URL-reference to a Brand).
- **Iterations:** 100,000 per benchmark, with 1,000 warmup iterations
  before measurement begins.
- **Timing:** Node's `performance.now()`.
- **Build:** `npm run build` then `node bench/bench-jsonld-product.js`.
  The benchmark imports from `dist/` so we measure the published
  artifact, not the dev source.

## v0.1.0 — 2026-05-15

| Measurement                              | ops/sec        | µs/op |
|------------------------------------------|----------------|-------|
| `JSON.parse(jsonInput)` *(floor)*        | 1,910,921       | 0.52  |
| `validate(jsonInput)` *(string in)*      | 459,361         | 2.18  |
| `validate(parsedInput)` *(object in)*    | 776,741         | 1.29  |

**Machine spec for this baseline**

- Node.js v22.18.0
- Linux x64
- Other hardware details intentionally omitted — single-machine
  numbers are anchoring points, not commitments.

## Reading the numbers

- Constitution working target (from cycle 1 alignment): **< 1 ms for a
  typical Product**. We are at **2.18 µs** (string input) and **1.29 µs**
  (object input) — both ~460–775× under target.
- The string-vs-object gap (~890 ns) is JSON parsing overhead. Callers
  with already-parsed inputs (e.g., a CMS that has the object in memory)
  pay less.
- Validation alone is **CPU-bound, single-pass, in-memory**. There is no
  I/O. There is no async overhead. The hot path uses pre-flattened
  property lookups (O(1)), no parent-walking at runtime.

## When to re-measure

- After any code change in `core/src/validators/` or `core/src/rules/`.
- After any change to the registry shape that affects lookup cost.
- After a Node major-version upgrade.
- Per release, even if the validator code is untouched (catches
  regressions from dependency or build-tool updates).

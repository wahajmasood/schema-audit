# Cycle 1 Baseline Benchmark

> **Read this first.** The numbers below are a micro-benchmark —
> measured under best-case conditions (same input, hot V8 JIT, hot CPU
> cache, no concurrent load, no GC pressure, single machine). They are
> NOT a delivery guarantee, NOT representative of production workloads,
> and NOT a basis for capacity planning.
>
> They exist to anchor one question: *"is the validator fast enough
> that it isn't a bottleneck?"* The real production-style performance
> harness (heterogeneous inputs, multi-machine, GC pressure, concurrent
> context) lives in cycle 4 alongside the accuracy corpus.

## Methodology

- **Fixture:** `core/tests/fixtures/valid/typical-product.json` — one
  Product with 8 properties. The **same object** is validated 100,000
  times in a tight loop.
- **Iterations:** 100,000 per measurement, with 1,000 warmup iterations
  before timing starts.
- **Timing:** Node's `performance.now()`.
- **Build:** `npm run build` then `node bench/bench-jsonld-product.js`.
  Imports from `dist/` so we measure the published artifact, not dev
  source.

## v0.1.0 — 2026-05-15

| Measurement                                | ops/sec    | µs/op |
|--------------------------------------------|------------|-------|
| `JSON.parse(jsonInput)` *(parsing floor)*  | 1,910,921  | 0.52  |
| `validate(jsonInput)` *(string in)*        | 459,361    | 2.18  |
| `validate(parsedInput)` *(object in)*      | 776,741    | 1.29  |

**Machine spec for this baseline**

- Node.js v22.18.0
- Linux x64
- Single laptop. Single process. No concurrent load.

## What these numbers DO support

- The validator is CPU-bound, in-memory, allocation-light by design.
- The architecture (pre-flattened registry, O(1) lookups, synchronous
  single-pass, zero I/O) has no obvious bottleneck.
- On modern hardware in a normal application, the validator should not
  show up in your performance profile.

## What these numbers DO NOT support

- **Not a throughput guarantee.** V8's JIT had 1,000 warmup iterations
  to specialize the exact call shape, and the registry stayed in CPU
  cache for all 100,000 calls. Real workloads with heterogeneous
  inputs and concurrent code see slower per-op times.
- **Not predictive of your machine.** Different CPU, OS, Node version,
  or system load will produce different numbers. Run `npm run bench`
  locally to measure on your own hardware.
- **Not a basis for linear extrapolation.** "459,361 products per
  second" is a benchmark artifact, not a real-world rate. Validating
  N unique Products in production will take longer than `N / 459,361`
  seconds suggests.
- **Does not model GC pressure**, allocation churn, or contention with
  other code in the same Node process.
- **Single fixture.** We only measured one Product shape. Larger or
  more nested schemas will be slower.

## When to re-measure

- After any change in `core/src/validators/` or `core/src/rules/`.
- After any change to the registry shape that affects lookup cost.
- After a Node major-version upgrade.
- Per release, even when the validator code is untouched — catches
  regressions from devDependency or build-tool updates.

## What's coming in cycle 4

The production-shaped performance harness — heterogeneous inputs,
multi-machine measurement, GC pressure, concurrent load — ships
alongside the accuracy corpus in cycle 4 per the roadmap. That's
where real-world throughput claims will be earned by measurement
rather than inferred from a tight loop.

---

## v0.3.1 — 2026-05-16 — Heterogeneous-input baseline (cycle 4)

A second benchmark, designed to reflect real-world workloads more
honestly: iterates over the entire 15-sample corpus thousands of
times instead of calling the same input in a hot loop.

### Methodology

- **Corpus:** `core/tests/corpus/*.json` — 15 samples spanning
  Product (5 variants), the Article family (4 variants), Person
  (2), Organization (2), and Articles with inline Person /
  Organization objects (2).
- **Rounds:** 10,000 iterations of the *full* corpus
  (150,000 total `validate()` calls).
- **Warmup:** 100 iterations of the full corpus before timing.
- **Build:** `npm run build && node bench/bench-corpus.js`.

### v0.3.1 — Node v22.18.0 / linux x64

| Measurement | ops/sec | µs/op |
|-------------|---------|-------|
| **Heterogeneous total** (150,000 validations) | 759,176 | **1.32** |
| Slowest sample: `product-minimal` | 490,699 | 2.04 |
| Fastest sample: `person-minimal` | 2,797,649 | 0.36 |

### What this signal tells us

- Cost varies ~6× across the corpus: types with no Layer-2 rules
  (Person, Organization minimal) run sub-microsecond; types with
  full Layer-2 checks (Product variants) are around 1.5–2 µs.
- Heterogeneous workloads — what most callers experience — average
  about **1.32 µs/op**, between the per-sample fastest and slowest.
- This number is closer to a real-world delivery rate than the
  single-input micro-benchmark, but still subject to all the
  caveats from the v0.1.0 section: single machine, no concurrent
  load, no GC pressure modeled, no I/O context.

### What this does NOT prove

Same disclaimers as v0.1.0. The corpus is a curated subset, not
arbitrary production input. Numbers will vary on different
hardware. Throughput claims in real applications will be lower
due to surrounding I/O and concurrent work.

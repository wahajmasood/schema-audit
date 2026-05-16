// core/bench/bench-corpus.js
//
// Cycle 4 — heterogeneous-input benchmark. Iterates over the entire
// corpus (15 distinct samples) per round, measuring throughput across
// diverse inputs. This is the "production-shaped" measurement that
// BASELINE.md said was coming.
//
// Run via `npm run bench:corpus`. Imports from dist/ — build first.
//
// Output includes per-sample numbers (sorted) plus the heterogeneous
// total ops/sec for the full corpus iteration.

import { readFileSync, readdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = resolve(__dirname, "..", "tests", "corpus");

const ROUNDS = 10_000;
const WARMUP = 100;

const samples = readdirSync(CORPUS_DIR)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => ({
    name: basename(n, ".json"),
    input: JSON.parse(readFileSync(resolve(CORPUS_DIR, n), "utf8")),
  }));

console.log();
console.log("schema-audit corpus benchmark (heterogeneous inputs)");
console.log("====================================================");
console.log(`Samples:  ${samples.length}`);
console.log(`Rounds:   ${ROUNDS.toLocaleString()} per sample`);
console.log(`Node:     ${process.version}`);
console.log(`Platform: ${process.platform} ${process.arch}`);
console.log();

// Warmup
for (let r = 0; r < WARMUP; r++) {
  for (const s of samples) validate(s.input);
}

// Per-sample timings
const perSample = [];
for (const s of samples) {
  const start = performance.now();
  for (let r = 0; r < ROUNDS; r++) validate(s.input);
  const elapsed = performance.now() - start;
  perSample.push({
    name: s.name,
    usPerOp: (elapsed * 1000) / ROUNDS,
    opsPerSec: (ROUNDS / elapsed) * 1000,
  });
}
perSample.sort((a, b) => a.usPerOp - b.usPerOp);

console.log("Per-sample (sorted fastest → slowest):");
for (const r of perSample) {
  console.log(
    "  " +
      r.name.padEnd(40) +
      r.opsPerSec.toFixed(0).padStart(10) +
      " ops/sec   " +
      r.usPerOp.toFixed(2).padStart(6) +
      " µs/op",
  );
}

// Heterogeneous total — interleave samples per round (closer to a
// real workload that doesn't repeat the same shape).
const startHet = performance.now();
for (let r = 0; r < ROUNDS; r++) {
  for (const s of samples) validate(s.input);
}
const elapsedHet = performance.now() - startHet;
const totalOps = ROUNDS * samples.length;
const usPerOpHet = (elapsedHet * 1000) / totalOps;
const opsPerSecHet = (totalOps / elapsedHet) * 1000;

console.log();
console.log(
  "Heterogeneous total: " +
    opsPerSecHet.toFixed(0).padStart(10) +
    " ops/sec   " +
    usPerOpHet.toFixed(2).padStart(6) +
    " µs/op   (" +
    totalOps.toLocaleString() +
    " validations)",
);
const slowest = perSample[perSample.length - 1];
const fastest = perSample[0];
console.log(
  `Slowest sample:   ${slowest.name} (${slowest.usPerOp.toFixed(2)} µs/op)`,
);
console.log(
  `Fastest sample:   ${fastest.name} (${fastest.usPerOp.toFixed(2)} µs/op)`,
);
console.log();

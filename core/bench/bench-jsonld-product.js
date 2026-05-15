// core/bench/bench-jsonld-product.js
//
// Cycle 1 baseline benchmark — informational only (no CI regression
// gate in cycle 1; that comes in a later cycle once we have baselines
// across multiple machines).
//
// Measures three things on the typical-product fixture:
//   1. JSON.parse alone (overhead floor for raw-string inputs)
//   2. validate() on raw JSON string (parse + validate)
//   3. validate() on already-parsed object (validate only)
//
// Imports from dist/ so we measure the published artifact, not the
// dev source. Run `npm run build` before this.

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(
  __dirname,
  "..",
  "tests",
  "fixtures",
  "valid",
  "typical-product.json",
);

const jsonInput = readFileSync(FIXTURE, "utf8");
const parsedInput = JSON.parse(jsonInput);

const ITERATIONS = 100_000;
const WARMUP = 1_000;

function bench(label, fn) {
  for (let i = 0; i < WARMUP; i++) fn();

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const elapsed = performance.now() - start;

  const opsPerSec = (ITERATIONS / elapsed) * 1000;
  const usPerOp = (elapsed * 1000) / ITERATIONS;
  console.log(
    label.padEnd(40) +
      opsPerSec.toFixed(0).padStart(12) +
      " ops/sec   " +
      usPerOp.toFixed(2).padStart(6) +
      " μs/op",
  );
}

console.log();
console.log("schema-audit cycle-1 baseline benchmark");
console.log("=======================================");
console.log("Fixture: typical-product.json (Product with 8 properties)");
console.log("Iterations: " + ITERATIONS.toLocaleString());
console.log("Node: " + process.version);
console.log("Platform: " + process.platform + " " + process.arch);
console.log();

bench("JSON.parse(jsonInput) [floor]", () => JSON.parse(jsonInput));
bench("validate(jsonInput)   [string]", () => validate(jsonInput));
bench("validate(parsedInput) [object]", () => validate(parsedInput));

console.log();

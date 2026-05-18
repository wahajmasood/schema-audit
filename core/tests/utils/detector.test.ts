import { test } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../../src/utils/detector.js";

test("empty string → unknown", () => {
  assert.equal(detect(""), "unknown");
});

test("whitespace-only → unknown", () => {
  assert.equal(detect("   \n\t  "), "unknown");
});

test("JSON object → jsonld", () => {
  assert.equal(detect('{"@type":"Product"}'), "jsonld");
});

test("JSON array → jsonld", () => {
  assert.equal(detect("[{}]"), "jsonld");
});

test("JSON with leading whitespace → jsonld", () => {
  assert.equal(detect("  \n  {}"), "jsonld");
});

test("HTML with itemscope → microdata", () => {
  assert.equal(
    detect('<div itemscope itemtype="https://schema.org/Product"></div>'),
    "microdata",
  );
});

test("HTML with ITEMSCOPE (uppercase) → microdata", () => {
  assert.equal(detect("<DIV ITEMSCOPE></DIV>"), "microdata");
});

test("HTML with typeof= → rdfa", () => {
  assert.equal(detect('<div typeof="Product"></div>'), "rdfa");
});

test("HTML with vocab= → rdfa", () => {
  assert.equal(detect('<div vocab="https://schema.org/"></div>'), "rdfa");
});

test("HTML with itemscope wins over typeof= → microdata", () => {
  assert.equal(
    detect('<div itemscope typeof="Product"></div>'),
    "microdata",
  );
});

test("HTML with itemtype but no itemscope → microdata (broken markup routes correctly)", () => {
  // The extractor will surface NO_ITEMSCOPE; detector just gets it
  // to the right pipeline.
  assert.equal(
    detect('<div itemtype="https://schema.org/Product"></div>'),
    "microdata",
  );
});

test("HTML with neither itemscope nor typeof= → unknown", () => {
  assert.equal(detect("<html><body><p>Hi</p></body></html>"), "unknown");
});

test("Plain text → unknown", () => {
  assert.equal(detect("Hello world"), "unknown");
});

test("Non-string → unknown", () => {
  // Cast to bypass TypeScript; runtime behavior matters here.
  assert.equal(detect(null as unknown as string), "unknown");
  assert.equal(detect(undefined as unknown as string), "unknown");
  assert.equal(detect(42 as unknown as string), "unknown");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHuman } from "../../src/cli/render.js";
import type { ValidationResult } from "../../src/types.js";

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    valid: true,
    format: "jsonld",
    types: ["Product"],
    errors: [],
    warnings: [],
    info: [],
    registry: {
      schemaVersion: "schema.org-2026-05-18",
      snapshotAt: "2026-05-18T00:00:00Z",
      curatedRulesVersion: "google-rich-results-docs-2026-05-16",
    },
    ...overrides,
  };
}

test("valid with no issues", () => {
  const out = renderHuman(makeResult(), { version: "0.7.0" });
  assert.match(out, /✓ Product \(valid\)/);
  assert.match(out, /No errors\. No warnings\./);
  assert.match(out, /schema-audit v0\.7\.0/);
  assert.match(out, /format: jsonld/);
  assert.match(out, /registry: schema\.org-2026-05-18/);
});

test("valid with warnings", () => {
  const result = makeResult({
    warnings: [
      {
        type: "warning",
        code: "MISSING_RECOMMENDED_PROPERTY",
        path: "Product.brand",
        message: "Recommended property \"brand\" is missing.",
        value: null,
      },
      {
        type: "warning",
        code: "MISSING_RECOMMENDED_PROPERTY",
        path: "Product.sku",
        message: "Recommended property \"sku\" is missing.",
        value: null,
      },
    ],
  });
  const out = renderHuman(result, { version: "0.7.0" });
  assert.match(out, /✓ Product \(valid\)/);
  assert.match(out, /0 errors, 2 warnings/);
  assert.match(out, /\[W\] MISSING_RECOMMENDED_PROPERTY at Product\.brand/);
  assert.match(out, /\[W\] MISSING_RECOMMENDED_PROPERTY at Product\.sku/);
});

test("invalid with errors", () => {
  const result = makeResult({
    valid: false,
    errors: [
      {
        type: "error",
        code: "MISSING_REQUIRED_PROPERTY",
        path: "Product",
        message:
          "Type Product requires at least one of: [offers, review, aggregateRating] (Google Rich Results).",
        value: null,
      },
    ],
  });
  const out = renderHuman(result, { version: "0.7.0" });
  assert.match(out, /✗ Product \(invalid\)/);
  assert.match(out, /1 error, 0 warnings/);
  assert.match(out, /\[E\] MISSING_REQUIRED_PROPERTY at Product/);
});

test("empty result (no items extracted)", () => {
  const result = makeResult({ types: [], format: "microdata" });
  const out = renderHuman(result, { version: "0.7.0" });
  assert.match(out, /∅ No items found/);
  assert.match(out, /format: microdata/);
});

test("error with empty path renders without 'at' suffix", () => {
  const result = makeResult({
    valid: false,
    errors: [
      {
        type: "error",
        code: "PARSE_ERROR",
        path: "",
        message: "Input is not valid JSON: Unexpected token.",
        value: null,
      },
    ],
  });
  const out = renderHuman(result, { version: "0.7.0" });
  assert.match(out, /\[E\] PARSE_ERROR\n/);
  assert.doesNotMatch(out, /\[E\] PARSE_ERROR at /);
});

test("path '@context' is preserved", () => {
  const result = makeResult({
    valid: false,
    errors: [
      {
        type: "error",
        code: "INSECURE_CONTEXT",
        path: "@context",
        message: "@context must use https://, not http://.",
        value: "http://schema.org",
      },
    ],
  });
  const out = renderHuman(result, { version: "0.7.0" });
  assert.match(out, /\[E\] INSECURE_CONTEXT at @context/);
});

// Implements the 12 Given/When/Then scenarios from
// changes/jsonld-product-l1/spec-delta.md.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

function loadFixture(category: "valid" | "invalid", name: string): string {
  return readFileSync(resolve(FIXTURES, category, `${name}.json`), "utf8");
}

describe("Scenario 1: Valid Product passes", () => {
  test("minimal product", () => {
    const result = validate(loadFixture("valid", "minimal-product"));
    assert.equal(result.valid, true);
    assert.equal(result.format, "jsonld");
    assert.deepEqual(result.types, ["Product"]);
    assert.equal(result.errors.length, 0);
    assert.equal(typeof result.registry.schemaVersion, "string");
    assert.equal(typeof result.registry.snapshotAt, "string");
  });

  test("typical product (full property set)", () => {
    const result = validate(loadFixture("valid", "typical-product"));
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test("product with inherited Thing properties", () => {
    const result = validate(loadFixture("valid", "product-with-inherited-props"));
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 2: Missing @context", () => {
  test("emits MISSING_CONTEXT with empty path and null value", () => {
    const result = validate(loadFixture("invalid", "missing-context"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "MISSING_CONTEXT");
    assert.ok(issue);
    assert.equal(issue.path, "");
    assert.equal(issue.value, null);
  });
});

describe("Scenario 3: Insecure @context", () => {
  test("emits INSECURE_CONTEXT on http://schema.org", () => {
    const result = validate(loadFixture("invalid", "insecure-context"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "INSECURE_CONTEXT");
    assert.ok(issue);
    assert.equal(issue.path, "@context");
    assert.equal(issue.value, "http://schema.org");
  });
});

describe("Scenario 4: Nonstandard @context", () => {
  test("emits warning; valid stays true in non-strict mode", () => {
    const result = validate(loadFixture("invalid", "nonstandard-context"));
    assert.equal(result.valid, true);
    const warn = result.warnings.find((w) => w.code === "NONSTANDARD_CONTEXT");
    assert.ok(warn);
    assert.equal(warn.type, "warning");
  });

  test("strict mode flips valid to false", () => {
    const result = validate(loadFixture("invalid", "nonstandard-context"), {
      strict: true,
    });
    assert.equal(result.valid, false);
  });
});

describe("Scenario 5: Missing @type", () => {
  test("emits MISSING_TYPE", () => {
    const result = validate(loadFixture("invalid", "missing-type"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "MISSING_TYPE");
    assert.ok(issue);
    assert.equal(issue.path, "");
  });
});

describe("Scenario 6: Unknown @type", () => {
  test("emits UNKNOWN_TYPE with the offending value", () => {
    const result = validate(loadFixture("invalid", "unknown-type"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "UNKNOWN_TYPE");
    assert.ok(issue);
    assert.equal(issue.value, "Banana");
    assert.equal(issue.path, "@type");
  });
});

describe("Scenario 7: Unknown property", () => {
  test("emits UNKNOWN_PROPERTY with dotted path", () => {
    const result = validate(loadFixture("invalid", "unknown-property"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "UNKNOWN_PROPERTY");
    assert.ok(issue);
    assert.equal(issue.path, "Product.quirkiness");
    assert.equal(issue.value, "high");
  });
});

describe("Scenario 8: Inherited property accepted", () => {
  test("Product.name (defined on Thing) raises no error", () => {
    const result = validate(loadFixture("valid", "product-with-inherited-props"));
    const nameIssue = result.errors.find((e) => e.path === "Product.name");
    assert.equal(nameIssue, undefined);
  });
});

describe("Scenario 9: Property value-type mismatch", () => {
  test("name: 42 emits INVALID_PROPERTY_VALUE_TYPE", () => {
    const result = validate(loadFixture("invalid", "invalid-property-value-type"));
    assert.equal(result.valid, false);
    const issue = result.errors.find(
      (e) => e.code === "INVALID_PROPERTY_VALUE_TYPE",
    );
    assert.ok(issue);
    assert.equal(issue.path, "Product.name");
    assert.equal(issue.value, 42);
  });
});

describe("Scenario 10: Invalid URL", () => {
  test("malformed URL emits INVALID_URL", () => {
    const result = validate(loadFixture("invalid", "invalid-url"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "INVALID_URL");
    assert.ok(issue);
    assert.equal(issue.path, "Product.url");
    assert.equal(issue.value, "not a url");
  });
});

describe("Scenario 11: Raw string input parsed", () => {
  test("validates a raw JSON string", () => {
    const result = validate(
      '{"@context":"https://schema.org","@type":"Product","name":"X"}',
    );
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Product"]);
  });

  test("validates a parsed object directly", () => {
    const result = validate({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "X",
    });
    assert.equal(result.valid, true);
  });
});

describe("Scenario 12: Parse error", () => {
  test("malformed JSON returns PARSE_ERROR (does not throw)", () => {
    const result = validate('{"@type":');
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "PARSE_ERROR");
    assert.ok(issue);
    assert.equal(issue.path, "");
  });
});

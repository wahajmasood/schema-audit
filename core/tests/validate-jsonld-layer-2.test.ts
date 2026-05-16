// Cycle 3 — implements the 10 Given/When/Then scenarios in
// changes/jsonld-rich-results-l2/spec-delta.md.

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

describe("Scenario 1: Valid Product with required + oneOf satisfied", () => {
  test("Product with offers passes", () => {
    const result = validate(loadFixture("valid", "product-with-offers"));
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 2: Product missing required `name` fails", () => {
  test("emits MISSING_REQUIRED_PROPERTY at Product.name", () => {
    const result = validate(
      loadFixture("invalid", "product-missing-required-name"),
    );
    assert.equal(result.valid, false);
    const issue = result.errors.find(
      (e) => e.code === "MISSING_REQUIRED_PROPERTY" && e.path === "Product.name",
    );
    assert.ok(issue);
  });
});

describe("Scenario 3: Product missing all of requiredOneOf fails", () => {
  test("emits MISSING_REQUIRED_PROPERTY at type-level path", () => {
    const result = validate(
      loadFixture("invalid", "product-missing-required-oneof"),
    );
    assert.equal(result.valid, false);
    const issue = result.errors.find(
      (e) => e.code === "MISSING_REQUIRED_PROPERTY" && e.path === "Product",
    );
    assert.ok(issue);
    assert.match(
      issue.message,
      /at least one of: \[offers, review, aggregateRating\]/,
    );
  });
});

describe("Scenario 4: Product with `review` satisfies oneOf", () => {
  test("review present → no oneOf error", () => {
    const result = validate(loadFixture("valid", "product-with-review"));
    assert.equal(result.valid, true);
    const oneOfErr = result.errors.find(
      (e) => e.code === "MISSING_REQUIRED_PROPERTY" && e.path === "Product",
    );
    assert.equal(oneOfErr, undefined);
  });
});

describe("Scenario 5: Product missing recommended `brand` warns", () => {
  test("warning not error, valid stays true", () => {
    const result = validate(
      loadFixture("invalid", "product-missing-recommended-brand"),
    );
    assert.equal(result.valid, true);
    const brandWarn = result.warnings.find(
      (w) =>
        w.code === "MISSING_RECOMMENDED_PROPERTY" &&
        w.path === "Product.brand",
    );
    assert.ok(brandWarn);
  });
});

describe("Scenario 6: strict mode flips warning to invalid", () => {
  test("same fixture under strict: true → valid=false", () => {
    const result = validate(
      loadFixture("invalid", "product-missing-recommended-brand"),
      { strict: true },
    );
    assert.equal(result.valid, false);
  });
});

describe("Scenario 7: Article with all recommended has no L2 warnings", () => {
  test("article-full-recommended fixture", () => {
    const result = validate(loadFixture("valid", "article-full-recommended"));
    assert.equal(result.valid, true);
    const layer2Warnings = result.warnings.filter(
      (w) => w.code === "MISSING_RECOMMENDED_PROPERTY",
    );
    assert.equal(layer2Warnings.length, 0);
  });
});

describe("Scenario 8: Article missing recommended warns per-missing", () => {
  test("article with only headline → 5 recommended warnings", () => {
    const result = validate(
      loadFixture("invalid", "article-missing-recommended"),
    );
    assert.equal(result.valid, true);
    const layer2Warnings = result.warnings.filter(
      (w) => w.code === "MISSING_RECOMMENDED_PROPERTY",
    );
    // headline is present; image, datePublished, author, dateModified, publisher missing
    assert.equal(layer2Warnings.length, 5);
  });
});

describe("Scenario 9: Person silently skips Layer 2", () => {
  test("Person with only name → no L2 issues", () => {
    const result = validate(loadFixture("valid", "person"));
    assert.equal(result.valid, true);
    const l2 = result.errors
      .concat(result.warnings)
      .filter(
        (i) =>
          i.code === "MISSING_REQUIRED_PROPERTY" ||
          i.code === "MISSING_RECOMMENDED_PROPERTY",
      );
    assert.equal(l2.length, 0);
  });
});

describe("Scenario 10: curatedRulesVersion in output", () => {
  test("non-empty string matching sourceVersion", () => {
    const result = validate(loadFixture("valid", "product-with-offers"));
    assert.equal(typeof result.registry.curatedRulesVersion, "string");
    assert.ok(result.registry.curatedRulesVersion.length > 0);
    assert.match(result.registry.curatedRulesVersion, /google-rich-results/);
  });
});

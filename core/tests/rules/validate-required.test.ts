import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequired } from "../../src/rules/validate-required.js";

test("empty required + empty oneOf → no issues", () => {
  const issues = validateRequired({}, "Product", [], []);
  assert.equal(issues.length, 0);
});

test("all required present → no issues", () => {
  const issues = validateRequired(
    { name: "X", image: "https://example.com/i.jpg" },
    "Product",
    ["name", "image"],
    [],
  );
  assert.equal(issues.length, 0);
});

test("one required missing → one MISSING_REQUIRED_PROPERTY", () => {
  const issues = validateRequired(
    { name: "X" },
    "Product",
    ["name", "image"],
    [],
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_REQUIRED_PROPERTY");
  assert.equal(issues[0]!.path, "Product.image");
});

test("two required missing → two issues", () => {
  const issues = validateRequired({}, "Product", ["name", "image"], []);
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((i) => i.path).sort(),
    ["Product.image", "Product.name"],
  );
});

test("requiredOneOf satisfied by first alternative → no issue", () => {
  const issues = validateRequired(
    { offers: "X" },
    "Product",
    [],
    [["offers", "review", "aggregateRating"]],
  );
  assert.equal(issues.length, 0);
});

test("requiredOneOf satisfied by second alternative → no issue", () => {
  const issues = validateRequired(
    { review: "X" },
    "Product",
    [],
    [["offers", "review", "aggregateRating"]],
  );
  assert.equal(issues.length, 0);
});

test("requiredOneOf unsatisfied → one issue at type path", () => {
  const issues = validateRequired(
    { name: "X" },
    "Product",
    [],
    [["offers", "review", "aggregateRating"]],
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_REQUIRED_PROPERTY");
  assert.equal(issues[0]!.path, "Product");
  assert.match(
    issues[0]!.message,
    /at least one of: \[offers, review, aggregateRating\]/,
  );
});

test("simple + oneOf both unsatisfied → multiple issues", () => {
  const issues = validateRequired(
    {},
    "Product",
    ["name", "image"],
    [["offers", "review", "aggregateRating"]],
  );
  assert.equal(issues.length, 3);
});

test("undefined and null values count as missing", () => {
  const issues = validateRequired(
    { name: undefined, image: null },
    "Product",
    ["name", "image"],
    [],
  );
  assert.equal(issues.length, 2);
});

test("empty string counts as present (matches real-world markup)", () => {
  const issues = validateRequired(
    { name: "" },
    "Product",
    ["name"],
    [],
  );
  assert.equal(issues.length, 0);
});

test("empty oneOf sub-array is skipped, not failed", () => {
  const issues = validateRequired({}, "Product", [], [[]]);
  assert.equal(issues.length, 0);
});

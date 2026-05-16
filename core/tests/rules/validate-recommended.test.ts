import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRecommended } from "../../src/rules/validate-recommended.js";

test("empty recommended list → no issues", () => {
  const issues = validateRecommended({}, "Article", []);
  assert.equal(issues.length, 0);
});

test("all recommended present → no issues", () => {
  const issues = validateRecommended(
    { headline: "X", image: "Y", datePublished: "2026-01-01" },
    "Article",
    ["headline", "image", "datePublished"],
  );
  assert.equal(issues.length, 0);
});

test("one recommended missing → one warning", () => {
  const issues = validateRecommended(
    { headline: "X" },
    "Article",
    ["headline", "image"],
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_RECOMMENDED_PROPERTY");
  assert.equal(issues[0]!.type, "warning");
  assert.equal(issues[0]!.path, "Article.image");
});

test("multiple recommended missing → one warning each", () => {
  const issues = validateRecommended(
    {},
    "Article",
    ["headline", "image", "datePublished", "author"],
  );
  assert.equal(issues.length, 4);
  for (const i of issues) {
    assert.equal(i.code, "MISSING_RECOMMENDED_PROPERTY");
    assert.equal(i.type, "warning");
  }
});

test("undefined/null values count as missing", () => {
  const issues = validateRecommended(
    { headline: null, image: undefined },
    "Article",
    ["headline", "image"],
  );
  assert.equal(issues.length, 2);
});

test("empty string is present (not flagged)", () => {
  const issues = validateRecommended(
    { headline: "" },
    "Article",
    ["headline"],
  );
  assert.equal(issues.length, 0);
});

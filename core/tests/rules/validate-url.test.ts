import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUrl } from "../../src/rules/validate-url.js";

test("https URL passes", () => {
  assert.equal(validateUrl("Product", "url", "https://example.com").length, 0);
});

test("http URL passes (structural check only)", () => {
  assert.equal(validateUrl("Product", "url", "http://example.com").length, 0);
});

test("URL with path and query passes", () => {
  assert.equal(
    validateUrl(
      "Product",
      "url",
      "https://example.com/path?q=1&r=2#frag",
    ).length,
    0,
  );
});

test("non-string fails", () => {
  const issues = validateUrl("Product", "url", 42);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INVALID_URL");
  assert.equal(issues[0]!.path, "Product.url");
  assert.equal(issues[0]!.value, 42);
});

test("malformed string fails", () => {
  const issues = validateUrl("Product", "url", "not a url");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INVALID_URL");
});

test("relative URL fails (URL constructor requires absolute)", () => {
  const issues = validateUrl("Product", "url", "/relative/path");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INVALID_URL");
});

test("empty string fails", () => {
  const issues = validateUrl("Product", "url", "");
  assert.equal(issues.length, 1);
});

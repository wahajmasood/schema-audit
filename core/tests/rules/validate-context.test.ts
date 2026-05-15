import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContext } from "../../src/rules/validate-context.js";

test("missing @context emits MISSING_CONTEXT", () => {
  const issues = validateContext(undefined);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_CONTEXT");
  assert.equal(issues[0]!.type, "error");
  assert.equal(issues[0]!.path, "");
  assert.equal(issues[0]!.value, null);
});

test("null @context emits MISSING_CONTEXT", () => {
  const issues = validateContext(null);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_CONTEXT");
});

test("http://schema.org emits INSECURE_CONTEXT", () => {
  const issues = validateContext("http://schema.org");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INSECURE_CONTEXT");
  assert.equal(issues[0]!.path, "@context");
});

test("http://www.schema.org emits INSECURE_CONTEXT", () => {
  const issues = validateContext("http://www.schema.org");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INSECURE_CONTEXT");
});

test("HTTP://Schema.ORG (mixed case) emits INSECURE_CONTEXT", () => {
  const issues = validateContext("HTTP://Schema.ORG");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INSECURE_CONTEXT");
});

test("https://schema.org emits no issue", () => {
  assert.equal(validateContext("https://schema.org").length, 0);
});

test("https://schema.org/ (trailing slash) emits no issue", () => {
  assert.equal(validateContext("https://schema.org/").length, 0);
});

test("https://www.schema.org emits no issue", () => {
  assert.equal(validateContext("https://www.schema.org").length, 0);
});

test("non-schema.org https URL emits NONSTANDARD_CONTEXT warning", () => {
  const issues = validateContext("https://example.com/custom");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "NONSTANDARD_CONTEXT");
  assert.equal(issues[0]!.type, "warning");
});

test("non-string @context emits NONSTANDARD_CONTEXT", () => {
  const issues = validateContext({ "@vocab": "https://schema.org/" });
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "NONSTANDARD_CONTEXT");
});

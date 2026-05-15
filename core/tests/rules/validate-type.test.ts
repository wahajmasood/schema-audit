import { test } from "node:test";
import assert from "node:assert/strict";
import { validateType } from "../../src/rules/validate-type.js";
import { loadRegistry } from "../../src/registry.js";

const registry = loadRegistry();

test("missing @type emits MISSING_TYPE", () => {
  const issues = validateType(undefined, registry);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "MISSING_TYPE");
  assert.equal(issues[0]!.path, "");
  assert.equal(issues[0]!.value, null);
});

test("null @type emits MISSING_TYPE", () => {
  assert.equal(validateType(null, registry)[0]!.code, "MISSING_TYPE");
});

test("empty string @type emits MISSING_TYPE", () => {
  assert.equal(validateType("", registry)[0]!.code, "MISSING_TYPE");
});

test("registered type emits no issue", () => {
  assert.equal(validateType("Product", registry).length, 0);
  assert.equal(validateType("Thing", registry).length, 0);
});

test("unregistered string @type emits UNKNOWN_TYPE", () => {
  const issues = validateType("Banana", registry);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "UNKNOWN_TYPE");
  assert.equal(issues[0]!.value, "Banana");
  assert.equal(issues[0]!.path, "@type");
});

test("array @type emits UNKNOWN_TYPE (multi-typed deferred)", () => {
  const issues = validateType(["Article", "BlogPosting"], registry);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "UNKNOWN_TYPE");
});

test("number @type emits UNKNOWN_TYPE", () => {
  assert.equal(validateType(42, registry)[0]!.code, "UNKNOWN_TYPE");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePropertyValueType } from "../../src/rules/validate-property-value-type.js";

test("string matches Text", () => {
  assert.equal(
    validatePropertyValueType("Product", "name", "Widget", ["Text"]).length,
    0,
  );
});

test("string matches URL", () => {
  assert.equal(
    validatePropertyValueType("Product", "url", "https://example.com", [
      "URL",
    ]).length,
    0,
  );
});

test("string matches object-type via URL reference", () => {
  assert.equal(
    validatePropertyValueType(
      "Product",
      "brand",
      "https://example.com/brand",
      ["Brand", "Organization"],
    ).length,
    0,
  );
});

test("number fails when only Text is expected", () => {
  const issues = validatePropertyValueType("Product", "name", 42, ["Text"]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "INVALID_PROPERTY_VALUE_TYPE");
  assert.equal(issues[0]!.path, "Product.name");
  assert.equal(issues[0]!.value, 42);
});

test("number matches Number", () => {
  assert.equal(
    validatePropertyValueType("Product", "price", 9.99, ["Number"]).length,
    0,
  );
});

test("number matches Integer", () => {
  assert.equal(
    validatePropertyValueType("Product", "count", 5, ["Integer"]).length,
    0,
  );
});

test("boolean matches Boolean", () => {
  assert.equal(
    validatePropertyValueType("Product", "inStock", true, ["Boolean"]).length,
    0,
  );
});

test("boolean fails when only Text expected", () => {
  const issues = validatePropertyValueType("Product", "name", true, ["Text"]);
  assert.equal(issues.length, 1);
});

test("object matches when an object-type is expected", () => {
  const issues = validatePropertyValueType(
    "Product",
    "brand",
    { "@type": "Brand", name: "Acme" },
    ["Brand", "Organization"],
  );
  assert.equal(issues.length, 0);
});

test("object fails when only primitives expected", () => {
  const issues = validatePropertyValueType("Product", "name", { foo: "bar" }, [
    "Text",
  ]);
  assert.equal(issues.length, 1);
});

test("array fails (out of cycle-1 scope)", () => {
  const issues = validatePropertyValueType("Product", "name", ["a", "b"], [
    "Text",
  ]);
  assert.equal(issues.length, 1);
});

test("null returns empty (orchestrator handles missing)", () => {
  assert.equal(
    validatePropertyValueType("Product", "name", null, ["Text"]).length,
    0,
  );
});

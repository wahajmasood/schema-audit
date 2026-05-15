import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePropertyExistence } from "../../src/rules/validate-property-existence.js";
import { loadRegistry } from "../../src/registry.js";

const registry = loadRegistry();

test("own property of Product passes", () => {
  assert.equal(
    validatePropertyExistence("Product", "brand", "x", registry).length,
    0,
  );
});

test("inherited property from Thing passes on Product", () => {
  assert.equal(
    validatePropertyExistence("Product", "name", "x", registry).length,
    0,
  );
  assert.equal(
    validatePropertyExistence("Product", "image", "x", registry).length,
    0,
  );
});

test("unknown property emits UNKNOWN_PROPERTY with dotted path", () => {
  const issues = validatePropertyExistence(
    "Product",
    "quirkiness",
    "high",
    registry,
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, "UNKNOWN_PROPERTY");
  assert.equal(issues[0]!.path, "Product.quirkiness");
  assert.equal(issues[0]!.value, "high");
});

test("unknown type returns empty (validateType handles missing type)", () => {
  const issues = validatePropertyExistence(
    "Banana",
    "name",
    "x",
    registry,
  );
  assert.equal(issues.length, 0);
});

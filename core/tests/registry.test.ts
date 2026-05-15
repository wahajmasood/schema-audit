import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, getTypeDef } from "../src/registry.js";

test("loadRegistry returns a stable singleton", () => {
  const r1 = loadRegistry();
  const r2 = loadRegistry();
  assert.equal(r1, r2);
  assert.equal(typeof r1.schemaVersion, "string");
  assert.equal(typeof r1.snapshotAt, "string");
  assert.equal(typeof r1.types, "object");
});

test("registry contains Thing and Product types from cycle-1 source", () => {
  const r = loadRegistry();
  assert.ok(r.types["Thing"]);
  assert.ok(r.types["Product"]);
});

test("getTypeDef('Product') returns pre-flattened definition", () => {
  const def = getTypeDef("Product");
  assert.ok(def);
  // Inherited from Thing
  assert.ok(def.allProperties["name"]);
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
  assert.deepEqual(def.allProperties["name"]!.valueTypes, ["Text"]);
  // Own
  assert.ok(def.allProperties["brand"]);
  assert.equal(def.allProperties["brand"]!.definedOn, "Product");
  // Parents chain
  assert.deepEqual(def.parents, ["Thing"]);
  // ownProperties does NOT include inherited
  assert.ok(!def.ownProperties.includes("name"));
  assert.ok(def.ownProperties.includes("brand"));
});

test("getTypeDef returns undefined for unknown type", () => {
  assert.equal(getTypeDef("Banana"), undefined);
});

test("Thing is a root type (empty parents chain)", () => {
  const def = getTypeDef("Thing");
  assert.ok(def);
  assert.deepEqual(def.parents, []);
});

test("snapshotAt is a parseable ISO-8601 timestamp", () => {
  const r = loadRegistry();
  const dt = new Date(r.snapshotAt);
  assert.equal(Number.isNaN(dt.getTime()), false);
});

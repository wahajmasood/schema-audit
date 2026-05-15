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

// ─── cycle 2: multi-type inheritance ────────────────────────────────

test("CreativeWork extends Thing (single-level parents chain)", () => {
  const def = getTypeDef("CreativeWork");
  assert.ok(def);
  assert.deepEqual(def.parents, ["Thing"]);
  // Owns 7 properties
  assert.equal(def.ownProperties.length, 7);
  // headline is own to CreativeWork
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  // name is inherited from Thing
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

test("Article extends CreativeWork (2-level parents chain)", () => {
  const def = getTypeDef("Article");
  assert.ok(def);
  assert.deepEqual(def.parents, ["CreativeWork", "Thing"]);
  // Own properties: articleBody, articleSection, wordCount
  assert.deepEqual(def.ownProperties.sort(), [
    "articleBody",
    "articleSection",
    "wordCount",
  ]);
  // articleBody defined on Article
  assert.equal(def.allProperties["articleBody"]!.definedOn, "Article");
  // headline inherited from CreativeWork
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  // name inherited from Thing
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

test("NewsArticle has the 4-level inheritance chain pre-flattened", () => {
  const def = getTypeDef("NewsArticle");
  assert.ok(def);
  assert.deepEqual(def.parents, ["Article", "CreativeWork", "Thing"]);
  // Own properties: dateline, printSection
  assert.deepEqual(def.ownProperties.sort(), ["dateline", "printSection"]);
  // Total: 5 (Thing) + 7 (CreativeWork) + 3 (Article) + 2 (NewsArticle) = 17
  assert.equal(Object.keys(def.allProperties).length, 17);
  // Verify a representative property from each ancestor
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  assert.equal(def.allProperties["articleBody"]!.definedOn, "Article");
  assert.equal(def.allProperties["dateline"]!.definedOn, "NewsArticle");
});

test("BlogPosting has empty ownProperties (pure-inheritance type)", () => {
  const def = getTypeDef("BlogPosting");
  assert.ok(def);
  assert.deepEqual(def.parents, ["Article", "CreativeWork", "Thing"]);
  assert.deepEqual(def.ownProperties, []);
  // 15 inherited properties (5 + 7 + 3 = 15)
  assert.equal(Object.keys(def.allProperties).length, 15);
  // headline still resolves through inheritance
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
});

test("Person extends Thing", () => {
  const def = getTypeDef("Person");
  assert.ok(def);
  assert.deepEqual(def.parents, ["Thing"]);
  assert.equal(def.allProperties["givenName"]!.definedOn, "Person");
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

test("Organization extends Thing", () => {
  const def = getTypeDef("Organization");
  assert.ok(def);
  assert.deepEqual(def.parents, ["Thing"]);
  assert.equal(def.allProperties["legalName"]!.definedOn, "Organization");
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

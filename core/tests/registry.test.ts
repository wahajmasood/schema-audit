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
  // Schema.org defines many more own properties than our cycle-2
  // hand-curated set; assert structural facts rather than exact counts.
  assert.ok(
    def.ownProperties.includes("headline"),
    "CreativeWork should own 'headline'",
  );
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  // name is inherited from Thing
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

test("Article extends CreativeWork (2-level parents chain)", () => {
  const def = getTypeDef("Article");
  assert.ok(def);
  assert.deepEqual(def.parents, ["CreativeWork", "Thing"]);
  // Spot-check that representative cycle-2 properties remain owned by
  // Article; schema.org adds many more own properties that we don't
  // enumerate here.
  assert.ok(def.ownProperties.includes("articleBody"));
  assert.ok(def.ownProperties.includes("articleSection"));
  assert.ok(def.ownProperties.includes("wordCount"));
  assert.equal(def.allProperties["articleBody"]!.definedOn, "Article");
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
});

test("NewsArticle has multi-level inheritance pre-flattened", () => {
  const def = getTypeDef("NewsArticle");
  assert.ok(def);
  // Schema.org has BlogPosting via SocialMediaPosting; cycle 5
  // auto-sync introduced that intermediate. NewsArticle keeps the
  // direct Article parent. parents is shortest chain root-last.
  assert.deepEqual(def.parents, ["Article", "CreativeWork", "Thing"]);
  // dateline and printSection are own to NewsArticle
  assert.ok(def.ownProperties.includes("dateline"));
  assert.ok(def.ownProperties.includes("printSection"));
  // Properties resolve from each ancestor
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  assert.equal(def.allProperties["articleBody"]!.definedOn, "Article");
  assert.equal(def.allProperties["dateline"]!.definedOn, "NewsArticle");
});

test("BlogPosting inherits from Article via SocialMediaPosting", () => {
  // Cycle 5 auto-sync added SocialMediaPosting as the canonical
  // intermediate parent of BlogPosting (cycle 2's hand-curated
  // source short-circuited to Article).
  const def = getTypeDef("BlogPosting");
  assert.ok(def);
  assert.deepEqual(def.parents, [
    "SocialMediaPosting",
    "Article",
    "CreativeWork",
    "Thing",
  ]);
  // headline still resolves through inheritance regardless of intermediate
  assert.equal(def.allProperties["headline"]!.definedOn, "CreativeWork");
  assert.equal(def.allProperties["name"]!.definedOn, "Thing");
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

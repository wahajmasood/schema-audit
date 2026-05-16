import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCuratedRules,
  getCuratedRules,
} from "../src/curated-rules.js";

test("loadCuratedRules returns a stable singleton", () => {
  const r1 = loadCuratedRules();
  const r2 = loadCuratedRules();
  assert.equal(r1, r2);
  assert.equal(typeof r1.sourceVersion, "string");
  assert.equal(typeof r1.snapshotAt, "string");
  assert.equal(typeof r1.rules, "object");
});

test("snapshotAt is a parseable ISO-8601 timestamp", () => {
  const r = loadCuratedRules();
  const dt = new Date(r.snapshotAt);
  assert.equal(Number.isNaN(dt.getTime()), false);
});

test("Product has the documented Layer 2 shape", () => {
  const rules = getCuratedRules("Product");
  assert.ok(rules);
  assert.deepEqual(rules.required, ["name", "image"]);
  assert.deepEqual(rules.requiredOneOf, [
    ["offers", "review", "aggregateRating"],
  ]);
  assert.ok(Array.isArray(rules.recommended));
  assert.ok(rules.recommended.includes("brand"));
});

test("Article has recommended but no required", () => {
  const rules = getCuratedRules("Article");
  assert.ok(rules);
  assert.deepEqual(rules.required, []);
  assert.deepEqual(rules.requiredOneOf, []);
  assert.ok(rules.recommended.includes("headline"));
  assert.ok(rules.recommended.includes("datePublished"));
});

test("NewsArticle includes 'dateline' in recommended", () => {
  const rules = getCuratedRules("NewsArticle");
  assert.ok(rules);
  assert.ok(rules.recommended.includes("dateline"));
});

test("BlogPosting has a narrower recommended list", () => {
  const rules = getCuratedRules("BlogPosting");
  assert.ok(rules);
  // headline, image, datePublished, author per spec-delta
  assert.equal(rules.recommended.length, 4);
});

test("Person returns undefined (no Layer 2 rules)", () => {
  assert.equal(getCuratedRules("Person"), undefined);
});

test("Organization returns undefined in cycle 3", () => {
  assert.equal(getCuratedRules("Organization"), undefined);
});

test("Thing returns undefined", () => {
  assert.equal(getCuratedRules("Thing"), undefined);
});

test("sourceVersion is the documented snapshot identifier", () => {
  const r = loadCuratedRules();
  assert.match(r.sourceVersion, /^google-rich-results-docs-/);
});

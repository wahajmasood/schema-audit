import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRdfa } from "../../src/utils/rdfa-extractor.js";

test("simple Product extracts cleanly", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <span property="name">Widget</span>
    <a property="url" href="https://example.com/widget">link</a>
  </div>`;
  const { items, extractionIssues } = extractRdfa(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items.length, 1);
  assert.equal(items[0]!["@type"], "Product");
  assert.equal(items[0]!["name"], "Widget");
  assert.equal(items[0]!["url"], "https://example.com/widget");
});

test("vocab on ancestor inherits", () => {
  const html = `<html vocab="https://schema.org/"><body><div typeof="Product">
    <span property="name">X</span>
  </div></body></html>`;
  const { items, extractionIssues } = extractRdfa(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items[0]!["@type"], "Product");
});

test("fully-qualified typeof URL works without vocab", () => {
  const html = `<div typeof="https://schema.org/Product">
    <span property="name">X</span>
  </div>`;
  const { items, extractionIssues } = extractRdfa(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items[0]!["@type"], "Product");
});

test("typeof without ancestor vocab → NO_VOCAB", () => {
  const html = `<div typeof="Product"><span property="name">X</span></div>`;
  const { extractionIssues } = extractRdfa(html);
  const issue = extractionIssues.find((i) => i.code === "NO_VOCAB");
  assert.ok(issue);
});

test("CURIE typeof → INVALID_ITEMTYPE", () => {
  const html = `<div vocab="https://schema.org/" typeof="schema:Product"><span property="name">X</span></div>`;
  const { extractionIssues } = extractRdfa(html);
  const issue = extractionIssues.find((i) => i.code === "INVALID_ITEMTYPE");
  assert.ok(issue);
});

test("unknown type → INVALID_ITEMTYPE", () => {
  const html = `<div vocab="https://schema.org/" typeof="Banana"><span property="name">X</span></div>`;
  const { extractionIssues } = extractRdfa(html);
  const issue = extractionIssues.find((i) => i.code === "INVALID_ITEMTYPE");
  assert.ok(issue);
});

test("non-schema.org vocab silently produces no items", () => {
  const html = `<div vocab="https://other.example/" typeof="Thing"><span property="name">X</span></div>`;
  const { items, extractionIssues } = extractRdfa(html);
  assert.equal(items.length, 0);
  // No NO_VOCAB or INVALID_ITEMTYPE — vocab IS set, just not ours
  assert.equal(extractionIssues.length, 0);
});

test("content attribute overrides text content", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <span property="name" content="Widget">Marketing copy</span>
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["name"], "Widget");
});

test("a/link → href", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <a property="url" href="https://example.com/x">click</a>
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["url"], "https://example.com/x");
});

test("img → src", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <img property="image" src="https://example.com/x.jpg" alt="">
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["image"], "https://example.com/x.jpg");
});

test("time → datetime", () => {
  const html = `<div vocab="https://schema.org/" typeof="Article">
    <time property="datePublished" datetime="2026-05-18">May 18</time>
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["datePublished"], "2026-05-18");
});

test("nested typeof yields nested object", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <span property="name">Widget</span>
    <span property="brand" typeof="Organization">
      <span property="name">Acme</span>
    </span>
  </div>`;
  const { items } = extractRdfa(html);
  const brand = items[0]!["brand"] as Record<string, unknown>;
  assert.equal(typeof brand, "object");
  assert.equal(brand["@type"], "Organization");
  assert.equal(brand["name"], "Acme");
});

test("resource attribute used as URI value", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <span property="brand" resource="https://example.com/brand/acme">Acme</span>
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["brand"], "https://example.com/brand/acme");
});

test("multi-valued property attaches to each name", () => {
  const html = `<div vocab="https://schema.org/" typeof="Product">
    <span property="name description" content="Widget"></span>
  </div>`;
  const { items } = extractRdfa(html);
  assert.equal(items[0]!["name"], "Widget");
  assert.equal(items[0]!["description"], "Widget");
});

test("multiple top-level items extracted separately", () => {
  const html = `<html vocab="https://schema.org/"><body>
    <div typeof="Product"><span property="name">A</span></div>
    <div typeof="Product"><span property="name">B</span></div>
  </body></html>`;
  const { items } = extractRdfa(html);
  assert.equal(items.length, 2);
  assert.equal(items[0]!["name"], "A");
  assert.equal(items[1]!["name"], "B");
});

test("http://schema.org/ vocab is accepted (lenient)", () => {
  const html = `<div vocab="http://schema.org/" typeof="Product">
    <span property="name">X</span>
  </div>`;
  const { items, extractionIssues } = extractRdfa(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items[0]!["@type"], "Product");
});

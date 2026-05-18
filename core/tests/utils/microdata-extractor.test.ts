import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMicrodata } from "../../src/utils/microdata-extractor.js";

test("simple Product extracts cleanly", () => {
  const html = `
    <div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="Widget">
      <link itemprop="url" href="https://example.com/widget">
    </div>`;
  const { items, extractionIssues } = extractMicrodata(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items.length, 1);
  assert.equal(items[0]!["@type"], "Product");
  assert.equal(items[0]!["name"], "Widget");
  assert.equal(items[0]!["url"], "https://example.com/widget");
});

test("meta → content attribute", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><meta itemprop="name" content="Hello"></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["name"], "Hello");
});

test("a/link → href attribute", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><a itemprop="url" href="https://x.com/y">click</a></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["url"], "https://x.com/y");
});

test("img → src attribute", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><img itemprop="image" src="https://x.com/p.jpg" alt=""></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["image"], "https://x.com/p.jpg");
});

test("time → datetime attribute (preferred over textContent)", () => {
  const html = `<div itemscope itemtype="https://schema.org/Article"><time itemprop="datePublished" datetime="2026-05-18">May 18</time></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["datePublished"], "2026-05-18");
});

test("time → falls back to textContent when datetime missing", () => {
  const html = `<div itemscope itemtype="https://schema.org/Article"><time itemprop="datePublished">2026</time></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["datePublished"], "2026");
});

test("data → value attribute", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><data itemprop="sku" value="ABC-1">ABC-1</data></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["sku"], "ABC-1");
});

test("plain element → trimmed textContent", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><span itemprop="description">  Hello world  </span></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["description"], "Hello world");
});

test("nested itemscope yields nested object", () => {
  const html = `
    <div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="Widget">
      <span itemprop="brand" itemscope itemtype="https://schema.org/Brand">
        <meta itemprop="name" content="Acme">
      </span>
    </div>`;
  const { items } = extractMicrodata(html);
  const brand = items[0]!["brand"] as Record<string, unknown>;
  assert.equal(typeof brand, "object");
  assert.equal(brand["@type"], "Brand");
  assert.equal(brand["name"], "Acme");
});

test("itemtype without itemscope → NO_ITEMSCOPE", () => {
  const html = `<div itemtype="https://schema.org/Product"><meta itemprop="name" content="X"></div>`;
  const { extractionIssues } = extractMicrodata(html);
  const issue = extractionIssues.find((i) => i.code === "NO_ITEMSCOPE");
  assert.ok(issue);
});

test("top-level itemscope without itemtype → MISSING_ITEMTYPE", () => {
  const html = `<div itemscope><meta itemprop="name" content="X"></div>`;
  const { extractionIssues } = extractMicrodata(html);
  const issue = extractionIssues.find((i) => i.code === "MISSING_ITEMTYPE");
  assert.ok(issue);
});

test("non-schema.org itemtype → INVALID_ITEMTYPE", () => {
  const html = `<div itemscope itemtype="https://example.com/Product"></div>`;
  const { extractionIssues } = extractMicrodata(html);
  const issue = extractionIssues.find((i) => i.code === "INVALID_ITEMTYPE");
  assert.ok(issue);
});

test("multi-valued itemprop attaches to each name", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><meta itemprop="name description" content="Widget"></div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items[0]!["name"], "Widget");
  assert.equal(items[0]!["description"], "Widget");
});

test("multiple top-level items extracted separately", () => {
  const html = `
    <div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="A">
    </div>
    <div itemscope itemtype="https://schema.org/Product">
      <meta itemprop="name" content="B">
    </div>`;
  const { items } = extractMicrodata(html);
  assert.equal(items.length, 2);
  assert.equal(items[0]!["name"], "A");
  assert.equal(items[1]!["name"], "B");
});

test("http://schema.org/ itemtype is accepted (lenient)", () => {
  const html = `<div itemscope itemtype="http://schema.org/Product"><meta itemprop="name" content="X"></div>`;
  const { items, extractionIssues } = extractMicrodata(html);
  assert.equal(extractionIssues.length, 0);
  assert.equal(items[0]!["@type"], "Product");
});

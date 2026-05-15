// Cycle 2 — validates the 7 Given/When/Then scenarios for
// Article, NewsArticle, BlogPosting, Person, Organization
// per changes/jsonld-multi-type-l1/spec-delta.md.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

function loadFixture(category: "valid" | "invalid", name: string): string {
  return readFileSync(resolve(FIXTURES, category, `${name}.json`), "utf8");
}

describe("Scenario 1: Valid Article passes", () => {
  test("Article with CreativeWork-inherited and own properties", () => {
    const result = validate(loadFixture("valid", "article"));
    assert.equal(result.valid, true);
    assert.equal(result.format, "jsonld");
    assert.deepEqual(result.types, ["Article"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 2: Valid NewsArticle passes (4-level inheritance)", () => {
  test("NewsArticle exercising all 4 ancestors", () => {
    const result = validate(loadFixture("valid", "news-article"));
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["NewsArticle"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 3: Valid Person passes", () => {
  test("Person with givenName, jobTitle, worksFor URL ref", () => {
    const result = validate(loadFixture("valid", "person"));
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Person"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 4: Valid Organization passes", () => {
  test("Organization with legalName, founder URL ref, foundingDate", () => {
    const result = validate(loadFixture("valid", "organization"));
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Organization"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 5: BlogPosting with only inherited properties passes", () => {
  test("type with empty ownProperties still resolves all inherited", () => {
    const result = validate(loadFixture("valid", "blog-posting"));
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["BlogPosting"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 6: Article-specific property accepted on NewsArticle", () => {
  test("articleBody (own to Article) accepted on NewsArticle", () => {
    // The news-article fixture already includes articleBody.
    const result = validate(loadFixture("valid", "news-article"));
    const articleBodyError = result.errors.find(
      (e) => e.path === "NewsArticle.articleBody",
    );
    assert.equal(articleBodyError, undefined);
  });
});

describe("Scenario 7: Unknown property still flagged on Article", () => {
  test("Article.nonsense raises UNKNOWN_PROPERTY", () => {
    const result = validate(loadFixture("invalid", "article-unknown-property"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "UNKNOWN_PROPERTY");
    assert.ok(issue);
    assert.equal(issue.path, "Article.nonsense");
    assert.equal(issue.value, "x");
  });
});

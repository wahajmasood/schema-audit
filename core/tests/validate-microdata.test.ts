// Cycle 6 — implements the 12 Given/When/Then scenarios from
// changes/microdata-validator/spec-delta.md.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

function loadFixture(category: "valid" | "invalid", name: string): string {
  return readFileSync(resolve(FIXTURES, category, `${name}.html`), "utf8");
}

describe("Scenario 1: Valid Microdata Product passes", () => {
  test("auto-detect picks microdata; valid result", () => {
    const result = validate(loadFixture("valid", "microdata-product"));
    assert.equal(result.format, "microdata");
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Product"]);
    assert.equal(result.errors.length, 0);
  });
});

describe("Scenario 2: Explicit microdata format", () => {
  test("options.format=microdata bypasses auto-detect", () => {
    const result = validate(loadFixture("valid", "microdata-product"), {
      format: "microdata",
    });
    assert.equal(result.format, "microdata");
    assert.equal(result.valid, true);
  });
});

describe("Scenario 3: Element with itemtype but no itemscope fails", () => {
  test("emits NO_ITEMSCOPE", () => {
    const result = validate(loadFixture("invalid", "microdata-no-itemscope"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "NO_ITEMSCOPE");
    assert.ok(issue);
  });
});

describe("Scenario 4: Top-level itemscope without itemtype fails", () => {
  test("emits MISSING_ITEMTYPE", () => {
    const result = validate(
      loadFixture("invalid", "microdata-missing-itemtype"),
    );
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "MISSING_ITEMTYPE");
    assert.ok(issue);
  });
});

describe("Scenario 5: Unknown schema.org type fails", () => {
  test("itemtype Banana → INVALID_ITEMTYPE", () => {
    const result = validate(loadFixture("invalid", "microdata-unknown-type"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "INVALID_ITEMTYPE");
    assert.ok(issue);
  });
});

describe("Scenario 6: Non-schema.org itemtype URL fails", () => {
  test("itemtype example.com → INVALID_ITEMTYPE", () => {
    const result = validate(loadFixture("invalid", "microdata-invalid-itemtype"));
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "INVALID_ITEMTYPE");
    assert.ok(issue);
  });
});

describe("Scenario 7: Per-element value extraction works", () => {
  test("meta/link/img/time/span all extract correctly", () => {
    const html = `<!DOCTYPE html><html><body>
      <article itemscope itemtype="https://schema.org/Article">
        <meta itemprop="headline" content="My Headline">
        <link itemprop="url" href="https://example.com/a">
        <img itemprop="image" src="https://example.com/i.jpg" alt="">
        <time itemprop="datePublished" datetime="2026-05-18">May 18</time>
        <span itemprop="articleBody">A short article body.</span>
      </article>
    </body></html>`;
    const result = validate(html);
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Article"]);
    // The Article should validate cleanly since these are all known props
    assert.equal(
      result.errors.length,
      0,
      `unexpected errors: ${JSON.stringify(result.errors)}`,
    );
  });
});

describe("Scenario 8: Nested itemscope yields a nested object", () => {
  test("Product with nested Brand validates cleanly", () => {
    const result = validate(
      loadFixture("valid", "microdata-with-nested-brand"),
    );
    assert.equal(result.valid, true);
    assert.deepEqual(result.types, ["Product"]);
    // No INVALID_PROPERTY_VALUE_TYPE error on brand — nested object
    // satisfies "object value for object-type property" rule.
    const brandError = result.errors.find((e) =>
      e.path.startsWith("Product.brand"),
    );
    assert.equal(brandError, undefined);
  });
});

describe("Scenario 9: Multiple top-level items", () => {
  test("two Products → types=[Product,Product]; paths index-prefixed", () => {
    const html = `<!DOCTYPE html><html><body>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="A">
        <img itemprop="image" src="https://example.com/a.jpg" alt="">
        <link itemprop="offers" href="https://example.com/o/a">
      </div>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="B">
        <img itemprop="image" src="https://example.com/b.jpg" alt="">
        <link itemprop="offers" href="https://example.com/o/b">
      </div>
    </body></html>`;
    const result = validate(html);
    assert.deepEqual(result.types, ["Product", "Product"]);
    // Any layer-2 warnings should be index-prefixed
    for (const w of result.warnings) {
      assert.match(
        w.path,
        /^Product\[\d+\]/,
        `expected indexed path, got ${w.path}`,
      );
    }
  });
});

describe("Scenario 10: HTML with no Microdata → UNKNOWN_FORMAT", () => {
  test("auto-detect returns unknown; UNKNOWN_FORMAT error", () => {
    const result = validate("<html><body><p>No structured data here.</p></body></html>");
    assert.equal(result.valid, false);
    const issue = result.errors.find((e) => e.code === "UNKNOWN_FORMAT");
    assert.ok(issue);
  });
});

describe("Scenario 11: Embedded JSON-LD in HTML is NOT extracted in cycle 6", () => {
  test("HTML with only <script type=application/ld+json> → UNKNOWN_FORMAT", () => {
    const html = `<!DOCTYPE html><html><head>
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"X","image":"https://x.com/i.jpg","offers":"https://x.com/o"}
      </script>
    </head><body></body></html>`;
    const result = validate(html);
    // No itemscope, no typeof=, no vocab= → unknown
    assert.equal(result.valid, false);
    assert.ok(result.errors.find((e) => e.code === "UNKNOWN_FORMAT"));
  });
});

describe("Scenario 12: Layer 2 fires on Microdata Product", () => {
  test("Product missing required oneOf → MISSING_REQUIRED_PROPERTY", () => {
    const html = `<!DOCTYPE html><html><body>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="No-Offers Widget">
        <img itemprop="image" src="https://example.com/x.jpg" alt="">
      </div>
    </body></html>`;
    const result = validate(html);
    assert.equal(result.valid, false);
    const issue = result.errors.find(
      (e) => e.code === "MISSING_REQUIRED_PROPERTY" && e.path === "Product",
    );
    assert.ok(issue);
  });
});

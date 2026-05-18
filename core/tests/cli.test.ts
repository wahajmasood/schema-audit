// Cycle 8 — implements the 12 Given/When/Then scenarios from
// changes/cli-wrapper/spec-delta.md.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Writable, Readable } from "node:stream";
import { runCli } from "../src/cli.js";
import { VERSION } from "../src/index.js";

function captureWritable(): { stream: Writable; output: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      cb();
    },
  });
  return { stream, output: () => Buffer.concat(chunks).toString("utf8") };
}

const VALID_PRODUCT = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Widget",
  image: "https://example.com/w.jpg",
  offers: "https://example.com/o",
});

const INVALID_PRODUCT = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "No Offers",
  image: "https://example.com/x.jpg",
  // missing offers/review/aggregateRating → MISSING_REQUIRED_PROPERTY
});

const VALID_PRODUCT_FILE = "/fake/valid-product.json";
const INVALID_PRODUCT_FILE = "/fake/invalid-product.json";
const MICRODATA_FILE = "/fake/page.html";
const MICRODATA_HTML = `<!DOCTYPE html><html><body>
  <div itemscope itemtype="https://schema.org/Product">
    <meta itemprop="name" content="X">
    <img itemprop="image" src="https://x.com/x.jpg" alt="">
    <link itemprop="offers" href="https://x.com/o">
  </div>
</body></html>`;

const fixtureFiles: Record<string, string> = {
  [VALID_PRODUCT_FILE]: VALID_PRODUCT,
  [INVALID_PRODUCT_FILE]: INVALID_PRODUCT,
  [MICRODATA_FILE]: MICRODATA_HTML,
};

async function mockReadFile(path: string): Promise<string> {
  const content = fixtureFiles[path];
  if (content === undefined) {
    const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
    (err as { code?: string }).code = "ENOENT";
    throw err;
  }
  return content;
}

describe("Scenario 1: validate a valid JSON-LD file", () => {
  test("✓ exits 0", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", VALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 0);
    assert.match(stdout.output(), /✓ Product \(valid\)/);
    assert.equal(stderr.output(), "");
  });
});

describe("Scenario 2: validate an invalid file", () => {
  test("✗ exits 1 (implicit validate)", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: [INVALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 1);
    assert.match(stdout.output(), /✗ Product \(invalid\)/);
    assert.match(stdout.output(), /MISSING_REQUIRED_PROPERTY/);
  });
});

describe("Scenario 3: stdin input", () => {
  test("reads from stdin when no file given", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const stdin = Readable.from([VALID_PRODUCT]);
    const code = await runCli({
      argv: [],
      stdin,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
    assert.match(stdout.output(), /✓ Product \(valid\)/);
  });

  test("'-' positional reads from stdin", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const stdin = Readable.from([VALID_PRODUCT]);
    const code = await runCli({
      argv: ["-"],
      stdin,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
  });
});

describe("Scenario 4: detect subcommand", () => {
  test("prints microdata for HTML with itemscope", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["detect", MICRODATA_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 0);
    assert.equal(stdout.output().trim(), "microdata");
  });
});

describe("Scenario 5: --format override", () => {
  test("explicit --format jsonld works", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "--format", "jsonld", VALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 0);
  });

  test("invalid --format value → exit 2", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "--format", "xyz", VALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 2);
    assert.match(stderr.output(), /invalid --format/);
  });
});

describe("Scenario 6: --strict flips warnings to invalid", () => {
  test("valid Product with warnings → exit 1 under --strict", async () => {
    // Product with required satisfied but recommended missing → warnings.
    const product = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Bare",
      image: "https://x.com/x.jpg",
      offers: "https://x.com/o",
      // missing brand, sku, gtin, description, mpn, audience → 6 warnings
    });
    fixtureFiles["/fake/bare-product.json"] = product;
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "--strict", "/fake/bare-product.json"],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 1);
  });
});

describe("Scenario 7: --json output", () => {
  test("output is parseable JSON", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "--json", VALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout.output());
    assert.equal(parsed.valid, true);
    assert.equal(parsed.format, "jsonld");
    assert.deepEqual(parsed.types, ["Product"]);
    assert.ok(parsed.registry);
  });
});

describe("Scenario 8: --help", () => {
  test("prints usage and exits 0", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["--help"],
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
    const help = stdout.output();
    assert.match(help, /Usage:/);
    assert.match(help, /validate/);
    assert.match(help, /detect/);
    assert.match(help, /Options:/);
    assert.match(help, /Exit codes:/);
  });

  test("-h short form works", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["-h"],
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
    assert.match(stdout.output(), /Usage:/);
  });
});

describe("Scenario 9: --version", () => {
  test("prints version and exits 0", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["--version"],
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
    assert.equal(stdout.output().trim(), `schema-audit v${VERSION}`);
  });

  test("-v short form works", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["-v"],
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    assert.equal(code, 0);
  });
});

describe("Scenario 10: unknown subcommand still validates", () => {
  // The CLI treats an unknown positional as a file path (implicit validate).
  // So "schema-audit xyz file.json" would try to read "xyz" as a file.
  test("treats unknown positional as a file path", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["xyz", "ignored"],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 2);
    assert.match(stderr.output(), /cannot read xyz/);
  });
});

describe("Scenario 11: file doesn't exist", () => {
  test("clear error message; exit 2", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "/fake/does-not-exist.json"],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 2);
    assert.match(stderr.output(), /cannot read \/fake\/does-not-exist\.json/);
  });
});

describe("Scenario 12: unrecognized flag", () => {
  test("clear error; exit 2", async () => {
    const stdout = captureWritable();
    const stderr = captureWritable();
    const code = await runCli({
      argv: ["validate", "--crazy", VALID_PRODUCT_FILE],
      stdout: stdout.stream,
      stderr: stderr.stream,
      readFile: mockReadFile,
    });
    assert.equal(code, 2);
    // parseArgs error message mentions the offending option
    assert.match(stderr.output(), /crazy|unknown/i);
  });
});

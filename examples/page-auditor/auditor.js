// page-auditor (JS) — validate structured data from stdin.
//
// Usage:
//   cat page.html | node auditor.js
//   curl -s https://example.com | node auditor.js
//
// Prints a one-line summary to stdout and any errors/warnings to
// stderr. Exits 0 when valid, 1 when invalid.

import { validate } from "schema-audit";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks).toString("utf8");

const result = validate(input);

const mark = result.valid ? "✓" : "✗";
const typesLabel = result.types.join(", ") || "(no items)";
console.log(`${mark} ${typesLabel} (${result.format})`);

for (const err of result.errors) {
  console.error(`[E] ${err.code} at ${err.path || "(top)"}: ${err.message}`);
}
for (const warn of result.warnings) {
  console.error(`[W] ${warn.code} at ${warn.path || "(top)"}: ${warn.message}`);
}

process.exit(result.valid ? 0 : 1);

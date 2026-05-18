// scripts/bump-version.mjs
//
// Cycle 11 — single-command version bump across both packages.
//
// Usage:
//   node scripts/bump-version.mjs <new-version>
//   node scripts/bump-version.mjs <new-version> --dry-run
//
// Touches three places (because the version lives in three places —
// pragmatic redundancy from cycle 9's TypedDict-typed-dict decision):
//
//   1. core/package.json                            "version": "X.Y.Z"
//   2. core/src/index.ts                            VERSION = "X.Y.Z"
//   3. python/src/schema_audit/__init__.py          VERSION = "X.Y.Z"
//
// Also prepends a "## [X.Y.Z] — YYYY-MM-DD" placeholder block to
// core/CHANGELOG.md so the user has somewhere to write the release
// notes. If anything goes wrong, the script reverts all four files —
// the repo never lands in a mixed-version state.
//
// Zero deps. Node stdlib only.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const PKG_JSON = resolve(REPO_ROOT, "core", "package.json");
const INDEX_TS = resolve(REPO_ROOT, "core", "src", "index.ts");
const PY_INIT = resolve(REPO_ROOT, "python", "src", "schema_audit", "__init__.py");
const CHANGELOG = resolve(REPO_ROOT, "core", "CHANGELOG.md");

const SEMVER_RE = /^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/;

// ─── 1. Parse args ─────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const newVersion = args.find((a) => !a.startsWith("--"));

if (!newVersion) {
  console.error("Usage: node scripts/bump-version.mjs <version> [--dry-run]");
  process.exit(2);
}

if (!SEMVER_RE.test(newVersion)) {
  console.error(
    `Invalid version: "${newVersion}". Must match X.Y.Z or X.Y.Z-prerelease.`,
  );
  process.exit(2);
}

// ─── 2. Read current state (for rollback + display) ────────────────

const original = {
  pkgJson: readFileSync(PKG_JSON, "utf8"),
  indexTs: readFileSync(INDEX_TS, "utf8"),
  pyInit: readFileSync(PY_INIT, "utf8"),
  changelog: readFileSync(CHANGELOG, "utf8"),
};

const currentPkg = JSON.parse(original.pkgJson);
const currentVersion = currentPkg.version;
console.log(`Bumping version: ${currentVersion} → ${newVersion}`);

// ─── 3. Compute new contents ───────────────────────────────────────

const newPkg = { ...currentPkg, version: newVersion };
// Preserve trailing newline (npm convention).
const newPkgText =
  JSON.stringify(newPkg, null, 2) +
  (original.pkgJson.endsWith("\n") ? "\n" : "");

const VERSION_TS_RE = /export const VERSION = "[^"]+";/;
if (!VERSION_TS_RE.test(original.indexTs)) {
  console.error(`Could not find VERSION constant in ${INDEX_TS}.`);
  process.exit(2);
}
const newIndexTs = original.indexTs.replace(
  VERSION_TS_RE,
  `export const VERSION = "${newVersion}";`,
);

const VERSION_PY_RE = /^VERSION = "[^"]+"$/m;
if (!VERSION_PY_RE.test(original.pyInit)) {
  console.error(`Could not find VERSION constant in ${PY_INIT}.`);
  process.exit(2);
}
const newPyInit = original.pyInit.replace(
  VERSION_PY_RE,
  `VERSION = "${newVersion}"`,
);

const today = new Date().toISOString().slice(0, 10);
const placeholder = `## [${newVersion}] — ${today}\n\n_Fill in release notes._\n\n`;
const FIRST_VERSION_HEADER_RE = /^## \[\d/m;
const match = original.changelog.match(FIRST_VERSION_HEADER_RE);
let newChangelog;
if (match) {
  const idx = match.index;
  newChangelog =
    original.changelog.slice(0, idx) +
    placeholder +
    original.changelog.slice(idx);
} else {
  // No existing version headers — append.
  newChangelog = original.changelog.trimEnd() + "\n\n" + placeholder;
}

// ─── 4. Dry-run output ─────────────────────────────────────────────

if (dryRun) {
  console.log("\n[--dry-run] No files written. Would update:");
  console.log(`  ${PKG_JSON}`);
  console.log(`  ${INDEX_TS}`);
  console.log(`  ${PY_INIT}`);
  console.log(`  ${CHANGELOG} (prepend placeholder)`);
  process.exit(0);
}

// ─── 5. Write all four ─────────────────────────────────────────────

const written = [];
function revert() {
  // Best-effort rollback. If this throws, the repo's mid-write state
  // is the user's problem — but writes are atomic per-file in Node so
  // partial writes within one file shouldn't happen.
  if (written.includes("pkg")) writeFileSync(PKG_JSON, original.pkgJson);
  if (written.includes("ts")) writeFileSync(INDEX_TS, original.indexTs);
  if (written.includes("py")) writeFileSync(PY_INIT, original.pyInit);
  if (written.includes("cl")) writeFileSync(CHANGELOG, original.changelog);
}

try {
  writeFileSync(PKG_JSON, newPkgText);
  written.push("pkg");
  writeFileSync(INDEX_TS, newIndexTs);
  written.push("ts");
  writeFileSync(PY_INIT, newPyInit);
  written.push("py");
  writeFileSync(CHANGELOG, newChangelog);
  written.push("cl");
} catch (err) {
  console.error(`Write failed: ${err.message}. Reverting written files.`);
  revert();
  process.exit(1);
}

console.log(`\n✓ Updated core/package.json`);
console.log(`✓ Updated core/src/index.ts`);
console.log(`✓ Updated python/src/schema_audit/__init__.py`);
console.log(`✓ Prepended placeholder to core/CHANGELOG.md`);
console.log(`\nNext: write release notes under "## [${newVersion}]" in CHANGELOG.md.`);

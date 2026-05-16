// scripts/sync-schema.mjs
//
// Cycle 5 — auto-syncs a curated set of schema.org types from the
// canonical JSON-LD graph into scripts/source-types.json. Replaces
// the hand-transcription toil of cycles 1–4.
//
// Run via `npm run sync-schema` (use cache if present) or
// `npm run sync:force` (force re-fetch).
//
// Zero runtime deps (Node ≥ 18 fetch).
//
// What this script does:
//   1. Loads schema.org's canonical JSON-LD from
//      https://schema.org/version/latest/schemaorg-current-https.jsonld
//      (uses scripts/.schemaorg-cache.jsonld if present, unless
//      --no-cache is passed).
//   2. Separates rdfs:Class entries (types) from rdf:Property entries.
//   3. Filters to the ALLOWLIST below — cycle 5 is 25 types.
//      Anything outside the allowlist is silently ignored.
//   4. Resolves single-parent inheritance. Multi-parent types in the
//      allowlist fail loudly (cycle 5 is single-parent only).
//   5. Inverts schema.org's property-centric model
//      (schema:domainIncludes points to types) into our type-centric
//      model (each type lists its own properties).
//   6. Writes scripts/source-types.json in the same shape
//      build-registry.mjs has always read.
//
// What this script does NOT do:
//   - Run at validator runtime (never — fetch is script-only).
//   - Modify core/src/* (validator code is unaffected).
//   - Pre-flatten inheritance (build-registry.mjs does that).
//   - Update Layer-2 curated rules (core/registry/curated-rules.json
//     stays hand-maintained — Google docs, not schema.org).

import {
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, ".schemaorg-cache.jsonld");
const SOURCE_TYPES_PATH = resolve(__dirname, "source-types.json");
const SCHEMA_URL =
  "https://schema.org/version/latest/schemaorg-current-https.jsonld";

// Allowlist of types we currently support (cycle 5: 25 types).
// Adding to this list and re-running sync expands coverage without
// touching the validator. Multi-parent types arrive in a later cycle.
const ALLOWLIST = [
  "Thing",
  "CreativeWork",
  "Article",
  "SocialMediaPosting", // intermediate: BlogPosting's parent in schema.org
  "NewsArticle",
  "BlogPosting",
  "Person",
  "Organization",
  "Product",
  "Book",
  "Movie",
  "MusicRecording",
  "HowTo", // intermediate: Recipe's parent in schema.org
  "Recipe",
  "Review",
  "WebSite",
  "WebPage",
  "FAQPage",
  "SoftwareApplication",
  "Course",
  "MediaObject",
  "VideoObject",
  "Event",
  "Place",
  "Intangible",
  "ItemList",
  "BreadcrumbList",
  "JobPosting",
];

const noCacheFlag = process.argv.includes("--no-cache");

// ─── 1. Load (fetch or cache) ────────────────────────────────────

async function loadGraph() {
  if (!noCacheFlag && existsSync(CACHE_PATH)) {
    console.log(`Using cached graph: ${CACHE_PATH}`);
    return readFileSync(CACHE_PATH, "utf8");
  }
  console.log(`Fetching ${SCHEMA_URL} ...`);
  try {
    const res = await fetch(SCHEMA_URL);
    if (!res.ok) {
      console.error(`Fetch failed: HTTP ${res.status}`);
      process.exit(1);
    }
    const text = await res.text();
    writeFileSync(CACHE_PATH, text);
    console.log(`Cached to ${CACHE_PATH}`);
    return text;
  } catch (err) {
    console.error(`Network error: ${err instanceof Error ? err.message : err}`);
    console.error("If the existing registry is fine, no action needed.");
    process.exit(1);
  }
}

// ─── 2. Helpers ─────────────────────────────────────────────────

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function shortName(idOrObj) {
  const id = typeof idOrObj === "string" ? idOrObj : idOrObj?.["@id"];
  if (!id || typeof id !== "string") return null;
  return id.startsWith("schema:") ? id.slice(7) : null;
}

// ─── 3. Main ─────────────────────────────────────────────────────

const graphText = await loadGraph();
const data = JSON.parse(graphText);
const graph = data["@graph"];
if (!Array.isArray(graph)) {
  console.error("Unexpected JSON-LD shape: top-level @graph missing.");
  process.exit(1);
}

// Separate classes from properties.
const classes = new Map();
const properties = new Map();
for (const entry of graph) {
  const types = toArray(entry["@type"]);
  const name = shortName(entry["@id"]);
  if (!name) continue;
  if (types.includes("rdfs:Class")) classes.set(name, entry);
  else if (types.includes("rdf:Property")) properties.set(name, entry);
}

console.log(
  `Parsed ${classes.size} schema.org classes, ${properties.size} properties.`,
);

// Verify allowlist coverage.
const missing = ALLOWLIST.filter((n) => !classes.has(n));
if (missing.length > 0) {
  console.error(
    `Allowlisted types not present in schema.org graph: ${missing.join(", ")}`,
  );
  process.exit(1);
}

// Build per-type entries with single-parent constraint.
const types = {};
for (const name of ALLOWLIST) {
  const cls = classes.get(name);
  const parentsRaw = toArray(cls["rdfs:subClassOf"]).map(shortName).filter(Boolean);
  const parentsInAllowlist = parentsRaw.filter((p) => ALLOWLIST.includes(p));

  if (name === "Thing") {
    types[name] = { parent: null, properties: {} };
    continue;
  }
  if (parentsInAllowlist.length === 0) {
    console.error(
      `Type "${name}" has parents [${parentsRaw.join(", ")}] but none in the allowlist. Add a parent to ALLOWLIST or remove "${name}".`,
    );
    process.exit(1);
  }
  if (parentsInAllowlist.length > 1) {
    // True ambiguity — multiple in-allowlist parents means we'd have to
    // pick one. Cycle 5 doesn't support multi-parent inheritance.
    console.error(
      `Type "${name}" has multiple parents in allowlist: [${parentsInAllowlist.join(", ")}]. Cycle 5 supports single-parent only.`,
    );
    process.exit(1);
  }
  // If parentsRaw had members outside the allowlist (e.g., Course
  // extends LearningResource + CreativeWork; we only have CreativeWork),
  // log the chosen-parent decision so the maintainer sees it.
  if (parentsRaw.length > parentsInAllowlist.length) {
    const dropped = parentsRaw.filter((p) => !ALLOWLIST.includes(p));
    console.log(
      `  Note: "${name}" has parents [${parentsRaw.join(", ")}]; using "${parentsInAllowlist[0]}" (allowlist); ignoring [${dropped.join(", ")}].`,
    );
  }
  types[name] = { parent: parentsInAllowlist[0], properties: {} };
}

// Walk every property; attach to each domainIncludes type that's in
// the allowlist. Range types stay raw — outside-allowlist ranges are
// fine (validator treats unknown object types via heuristic).
let attached = 0;
for (const [propName, prop] of properties) {
  const domains = toArray(prop["schema:domainIncludes"]).map(shortName);
  const ranges = toArray(prop["schema:rangeIncludes"])
    .map(shortName)
    .filter(Boolean);

  for (const domain of domains) {
    if (!ALLOWLIST.includes(domain)) continue;
    types[domain].properties[propName] = ranges;
    attached++;
  }
}

// ─── 4. Write ───────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const result = {
  _comment:
    "Auto-generated by scripts/sync-schema.mjs from schema.org's canonical JSON-LD graph. DO NOT EDIT BY HAND — re-run `npm run sync` instead. Layer-2 curated rules live in core/registry/curated-rules.json and are hand-maintained from Google docs (not schema.org).",
  schemaVersion: `schema.org-${today}`,
  types,
};

writeFileSync(SOURCE_TYPES_PATH, JSON.stringify(result, null, 2) + "\n");

const totalProps = Object.values(types).reduce(
  (sum, t) => sum + Object.keys(t.properties).length,
  0,
);

console.log();
console.log(`✓ Wrote ${SOURCE_TYPES_PATH}`);
console.log(`  Types: ${Object.keys(types).length}`);
console.log(`  Properties attached: ${attached} (avg ${(totalProps / ALLOWLIST.length).toFixed(1)} per type)`);
console.log(`  schemaVersion: ${result.schemaVersion}`);

// core/src/utils/rdfa-extractor.ts
//
// Parses HTML via parse5 and extracts RDFa items (`[typeof]`
// elements inside a `[vocab]` scope) into JSON-LD-shaped objects
// that the existing per-item validator can consume.
//
// Vocabulary resolution is top-down: as we recurse, we track the
// "current vocab" inherited from ancestors. When we encounter a
// `[typeof]` element, we use the inherited vocab to resolve a bare
// type name. If `typeof` is a fully-qualified schema.org URL, no
// vocab is needed.
//
// Per-element value-extraction rules (RDFa):
//
//   element has `content=` attribute  → content value (RDFa override)
//   meta                              → content
//   a, link                           → href
//   img/audio/video/...               → src
//   object                            → data
//   data, meter                       → value
//   time                              → datetime (fallback to text)
//   element with typeof=              → recursive extraction (nested obj)
//   element with resource= (no typeof) → resource value (URI ref)
//   anything else                     → trimmed textContent
//
// Cycle-7 limitations (documented):
//   - CURIE prefixes (typeof="schema:Product") not supported.
//   - Non-schema.org vocab subtrees silently produce no items.

import { parse } from "parse5";
import type { Issue } from "../types.js";
import { loadRegistry } from "../registry.js";
import { noVocab, invalidItemtype } from "../errors.js";

const registry = loadRegistry();

interface Attribute {
  name: string;
  value: string;
}
interface ParseElement {
  tagName: string;
  attrs: Attribute[];
  childNodes: ParseNode[];
}
interface ParseText {
  nodeName: "#text";
  value: string;
}
type ParseNode = ParseElement | ParseText | { childNodes?: ParseNode[] };

function isElement(node: unknown): node is ParseElement {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as ParseElement).tagName === "string" &&
    Array.isArray((node as ParseElement).attrs)
  );
}

function isTextNode(node: unknown): node is ParseText {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as ParseText).nodeName === "#text" &&
    typeof (node as ParseText).value === "string"
  );
}

function getAttr(el: ParseElement, name: string): string | undefined {
  for (const attr of el.attrs) {
    if (attr.name === name) return attr.value;
  }
  return undefined;
}

function hasAttr(el: ParseElement, name: string): boolean {
  return getAttr(el, name) !== undefined;
}

function children(node: ParseNode): ParseNode[] {
  return (node as { childNodes?: ParseNode[] }).childNodes ?? [];
}

function textContent(node: ParseNode): string {
  if (isTextNode(node)) return node.value;
  if (isElement(node)) {
    return node.childNodes.map(textContent).join("");
  }
  return children(node).map(textContent).join("");
}

const SCHEMA_VOCAB_RE = /^https?:\/\/(?:www\.)?schema\.org\/?$/;
const SCHEMA_TYPE_URL_RE =
  /^https?:\/\/(?:www\.)?schema\.org\/([A-Za-z][A-Za-z0-9]*)\/?$/;

/** Extract a value from a property element per RDFa rules. */
function extractElementValue(el: ParseElement): string {
  // RDFa: content attribute is the universal override.
  const content = getAttr(el, "content");
  if (content !== undefined) return content;

  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "meta":
      return ""; // unreachable: meta with no content already handled above
    case "a":
    case "link":
      return getAttr(el, "href") ?? "";
    case "img":
    case "audio":
    case "video":
    case "source":
    case "embed":
    case "iframe":
    case "track":
      return getAttr(el, "src") ?? "";
    case "object":
      return getAttr(el, "data") ?? "";
    case "data":
    case "meter":
      return getAttr(el, "value") ?? "";
    case "time": {
      const dt = getAttr(el, "datetime");
      return dt !== undefined ? dt : textContent(el).trim();
    }
    default: {
      // RDFa-specific: resource attribute is a URI reference when
      // present and no typeof is on the element.
      const resource = getAttr(el, "resource");
      if (resource !== undefined) return resource;
      return textContent(el).trim();
    }
  }
}

/**
 * Find descendants with `[property]` that belong to THIS scope.
 * Don't descend into nested `[typeof]` — they belong to the nested
 * item.
 */
function collectPropertyElements(scope: ParseElement): ParseElement[] {
  const result: ParseElement[] = [];
  function recurse(node: ParseNode) {
    if (!isElement(node)) {
      for (const c of children(node)) recurse(c);
      return;
    }
    const hasProp = hasAttr(node, "property");
    const isInnerType = hasAttr(node, "typeof") && node !== scope;

    if (hasProp) {
      result.push(node);
      // If also nested typeof, don't descend — children belong to
      // the nested item.
      if (hasAttr(node, "typeof")) return;
    } else if (isInnerType) {
      // Bare nested typeof (no property) — orphan from THIS scope.
      return;
    }
    for (const c of node.childNodes) recurse(c);
  }
  for (const c of scope.childNodes) recurse(c);
  return result;
}

export interface ExtractedRdfaItem {
  "@context"?: string;
  "@type"?: string;
  "@id"?: string;
  /** Raw typeof attribute value — diagnostic only. */
  "@itemtypeRaw"?: string;
  [propName: string]: unknown;
}

export interface RdfaExtractionResult {
  items: ExtractedRdfaItem[];
  extractionIssues: Issue[];
}

/**
 * Extract a single typeof'd item, recursing into nested typeof
 * elements for property values.
 *
 * @param currentVocab The vocab inherited from ancestors (null if
 *                     none was set). The element's own `vocab=` (if
 *                     present) overrides this.
 * @returns the extracted item, or null when the type can't be
 *          resolved (NO_VOCAB or non-schema.org vocab).
 */
function extractItem(
  el: ParseElement,
  currentVocab: string | null,
  issues: Issue[],
): ExtractedRdfaItem | null {
  const typeofVal = (getAttr(el, "typeof") ?? "").trim();
  const ownVocab = getAttr(el, "vocab");
  const vocab = ownVocab !== undefined ? ownVocab : currentVocab;

  let typeName: string | undefined;
  const itemtypeRaw = typeofVal;

  const fullUrlMatch = typeofVal.match(SCHEMA_TYPE_URL_RE);
  if (fullUrlMatch) {
    typeName = fullUrlMatch[1]!;
  } else if (typeofVal.includes(":")) {
    // CURIE — not supported in cycle 7.
    issues.push(
      invalidItemtype(
        typeofVal,
        "CURIE prefixes (schema:Product) are not supported in cycle 7. Use vocab= + bare typeof, or a fully-qualified URL.",
      ),
    );
    // continue without typeName; per-item will emit MISSING_TYPE.
  } else if (!vocab) {
    issues.push(noVocab(typeofVal));
    return null;
  } else if (!SCHEMA_VOCAB_RE.test(vocab.trim())) {
    // vocab is set but not schema.org — silently no item from this
    // subtree (the detector got us here, but this is a non-schema
    // RDFa document).
    return null;
  } else {
    // Bare name + schema.org vocab → resolved
    typeName = typeofVal;
  }

  if (typeName !== undefined && registry.types[typeName] === undefined) {
    issues.push(
      invalidItemtype(
        typeofVal,
        `Type "${typeName}" is not in the registry.`,
      ),
    );
    // keep typeName so per-item emits UNKNOWN_TYPE consistently
  }

  const item: ExtractedRdfaItem = {
    "@context": "https://schema.org",
  };
  if (typeName !== undefined) item["@type"] = typeName;
  item["@itemtypeRaw"] = itemtypeRaw;

  const resource = getAttr(el, "resource");
  if (resource !== undefined) item["@id"] = resource;

  // Collect properties.
  for (const propEl of collectPropertyElements(el)) {
    const propAttr = (getAttr(propEl, "property") ?? "").trim();
    const propNames = propAttr.split(/\s+/).filter(Boolean);
    if (propNames.length === 0) continue;

    let value: unknown;
    if (hasAttr(propEl, "typeof")) {
      // Nested item — pass our resolved vocab down
      const nested = extractItem(propEl, vocab ?? null, issues);
      value = nested ?? "";
    } else {
      value = extractElementValue(propEl);
    }
    for (const n of propNames) {
      item[n] = value;
    }
  }

  return item;
}

/**
 * Top-down walk. Tracks the current vocab as we recurse. When we
 * find an element with `[typeof]`, treat it as a top-level item
 * (don't descend further at that point — nested items are extracted
 * as part of the item's own recursion).
 */
function walkTopLevel(
  node: ParseNode,
  currentVocab: string | null,
  items: ExtractedRdfaItem[],
  issues: Issue[],
): void {
  if (!isElement(node)) {
    for (const c of children(node)) {
      walkTopLevel(c, currentVocab, items, issues);
    }
    return;
  }
  const ownVocab = getAttr(node, "vocab");
  const newVocab = ownVocab !== undefined ? ownVocab : currentVocab;

  if (hasAttr(node, "typeof")) {
    const item = extractItem(node, newVocab, issues);
    if (item !== null) items.push(item);
    return; // don't descend; nested typeofs handled by the item's own recursion
  }

  for (const c of node.childNodes) {
    walkTopLevel(c, newVocab, items, issues);
  }
}

export function extractRdfa(html: string): RdfaExtractionResult {
  const extractionIssues: Issue[] = [];

  let doc: ReturnType<typeof parse>;
  try {
    doc = parse(html);
  } catch (err) {
    extractionIssues.push(
      invalidItemtype(
        null,
        `HTML parse failure: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    return { items: [], extractionIssues };
  }

  const items: ExtractedRdfaItem[] = [];
  walkTopLevel(doc as unknown as ParseNode, null, items, extractionIssues);

  return { items, extractionIssues };
}

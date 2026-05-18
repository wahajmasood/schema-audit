// core/src/utils/microdata-extractor.ts
//
// Parses HTML via parse5 and extracts Microdata items into JSON-LD-
// shaped objects that the existing per-item validator can consume.
//
// Per-element value-extraction rules (HTML5 Microdata spec):
//   meta                       → content attribute
//   a, link                    → href attribute
//   img/audio/video/source/    → src attribute
//     embed/iframe/track
//   object                     → data attribute
//   data, meter                → value attribute
//   time                       → datetime attribute (fallback to textContent)
//   any element with itemscope → recursive extraction yields a nested object
//   anything else              → textContent (trimmed)
//
// Extraction-time issues (NO_ITEMSCOPE, MISSING_ITEMTYPE,
// INVALID_ITEMTYPE) are returned separately so the orchestrator can
// fold them in before the per-item validator runs.

import { parse } from "parse5";
import type { Issue } from "../types.js";
import { loadRegistry } from "../registry.js";
import {
  noItemscope,
  missingItemtype,
  invalidItemtype,
} from "../errors.js";

const registry = loadRegistry();

// parse5 tree node types are structurally distinct; we identify
// Element nodes by the presence of `tagName` + `attrs`.
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

/** Extract a schema.org type name from an itemtype URL. */
function extractTypeName(itemtype: string): string | null {
  const trimmed = itemtype.trim();
  const m = trimmed.match(
    /^https?:\/\/(?:www\.)?schema\.org\/([A-Za-z][A-Za-z0-9]*)\/?$/,
  );
  return m ? m[1]! : null;
}

/** Extract the value of an element acting as a Microdata property. */
function extractElementValue(el: ParseElement): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "meta":
      return getAttr(el, "content") ?? "";
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
    default:
      return textContent(el).trim();
  }
}

/**
 * Find descendant elements that bear `itemprop` and belong to THIS
 * scope. When a descendant is itself an itemscope (a nested item),
 * the recursion stops at that descendant — its own properties belong
 * to the nested item.
 */
function collectPropertyElements(scope: ParseElement): ParseElement[] {
  const result: ParseElement[] = [];
  function recurse(node: ParseNode) {
    if (!isElement(node)) {
      for (const c of children(node)) recurse(c);
      return;
    }
    const hasItemprop = hasAttr(node, "itemprop");
    const isInnerScope = hasAttr(node, "itemscope") && node !== scope;

    if (hasItemprop) {
      result.push(node);
      // If this element is also a nested itemscope, we DON'T descend
      // into its children — they belong to the nested item.
      if (hasAttr(node, "itemscope")) return;
    } else if (isInnerScope) {
      // Bare nested itemscope (no itemprop) is an orphan from THIS
      // scope's perspective; don't descend.
      return;
    }

    for (const c of node.childNodes) recurse(c);
  }
  for (const c of scope.childNodes) recurse(c);
  return result;
}

export interface ExtractedItem {
  "@context"?: string;
  "@type"?: string;
  "@id"?: string;
  /** Raw itemtype URL — diagnostic only, not validated. */
  "@itemtypeRaw"?: string;
  [propName: string]: unknown;
}

export interface MicrodataExtractionResult {
  items: ExtractedItem[];
  extractionIssues: Issue[];
}

function extractItem(
  el: ParseElement,
  isTopLevel: boolean,
  issues: Issue[],
): ExtractedItem | null {
  const itemtype = getAttr(el, "itemtype");
  let typeName: string | undefined;
  let itemtypeRaw: string | undefined;

  if (itemtype === undefined) {
    if (isTopLevel) {
      issues.push(missingItemtype());
      return null;
    }
    // Nested item without itemtype is allowed; just no @type.
  } else {
    itemtypeRaw = itemtype;
    const extracted = extractTypeName(itemtype);
    if (extracted === null) {
      issues.push(
        invalidItemtype(
          itemtype,
          "itemtype must be a schema.org URL (https://schema.org/<Type>).",
        ),
      );
      // Continue without typeName so per-item validator emits MISSING_TYPE.
    } else if (registry.types[extracted] === undefined) {
      issues.push(
        invalidItemtype(
          itemtype,
          `Type "${extracted}" is not in the registry.`,
        ),
      );
      // Pass through so per-item validator emits UNKNOWN_TYPE consistently.
      typeName = extracted;
    } else {
      typeName = extracted;
    }
  }

  const item: ExtractedItem = {
    "@context": "https://schema.org",
  };
  if (typeName !== undefined) item["@type"] = typeName;
  if (itemtypeRaw !== undefined) item["@itemtypeRaw"] = itemtypeRaw;

  const itemid = getAttr(el, "itemid");
  if (itemid !== undefined) item["@id"] = itemid;

  // Collect this scope's property elements + extract values.
  for (const propEl of collectPropertyElements(el)) {
    const itemprop = getAttr(propEl, "itemprop") ?? "";
    const propNames = itemprop.trim().split(/\s+/).filter(Boolean);
    if (propNames.length === 0) continue;

    let value: unknown;
    if (hasAttr(propEl, "itemscope")) {
      const nested = extractItem(propEl, false, issues);
      value = nested ?? "";
    } else {
      value = extractElementValue(propEl);
    }

    for (const name of propNames) {
      // Multi-value handling: last write wins. Multi-valued itemprop on
      // a single element does NOT repeat; same value attaches to each
      // name. Properties appearing on multiple elements within the same
      // scope take the last seen value (limitation documented in
      // cycle-6 spec-delta).
      item[name] = value;
    }
  }

  return item;
}

/** Find elements with `itemtype` but no `itemscope` (broken markup). */
function findOrphanItemtype(node: ParseNode, issues: Issue[]): void {
  if (isElement(node)) {
    if (hasAttr(node, "itemtype") && !hasAttr(node, "itemscope")) {
      issues.push(noItemscope(node.tagName));
    }
    for (const c of node.childNodes) findOrphanItemtype(c, issues);
  } else {
    for (const c of children(node)) findOrphanItemtype(c, issues);
  }
}

/** Find top-level itemscope elements (not nested in another itemscope). */
function findTopLevelItemscopes(node: ParseNode): ParseElement[] {
  const result: ParseElement[] = [];
  function recurse(n: ParseNode): void {
    if (isElement(n)) {
      if (hasAttr(n, "itemscope")) {
        result.push(n);
        return; // don't descend into a scope; its nesteds are extracted with it
      }
      for (const c of n.childNodes) recurse(c);
      return;
    }
    for (const c of children(n)) recurse(c);
  }
  recurse(node);
  return result;
}

export function extractMicrodata(html: string): MicrodataExtractionResult {
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

  // Surface itemtype-without-itemscope first (broken markup).
  findOrphanItemtype(doc as unknown as ParseNode, extractionIssues);

  // Extract top-level items.
  const topLevel = findTopLevelItemscopes(doc as unknown as ParseNode);
  const items: ExtractedItem[] = [];
  for (const el of topLevel) {
    const item = extractItem(el, true, extractionIssues);
    if (item !== null) items.push(item);
  }

  return { items, extractionIssues };
}

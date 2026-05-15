// core/src/registry.ts
//
// Typed loader for the schema-types registry.
//
// The registry JSON is bundled at build time (tsup/esbuild inlines it).
// Runtime does ZERO file I/O and ZERO parent-walking — the JSON was
// pre-flattened at build time by scripts/build-registry.mjs, per
// Design Tenet #4 ("Pre-index, don't recurse").

import rawRegistry from "../registry/schema-types.json";

/** A schema.org property definition. Mirrors the registry JSON shape. */
export interface PropertyDef {
  /** Allowed value types (e.g., "Text", "URL", "Organization"). */
  valueTypes: string[];
  /** Which type originally defined this property (may be an ancestor). */
  definedOn: string;
}

/** A type's pre-flattened registry entry. */
export interface TypeDef {
  /** Ancestor chain, immediate parent first, root last. Empty for root types. */
  parents: string[];
  /** All properties (own + inherited), pre-merged at build time. */
  allProperties: Record<string, PropertyDef>;
  /** Just this type's own (non-inherited) property names. */
  ownProperties: string[];
}

/** The full registry shape. */
export interface Registry {
  /** schema.org version string (or cycle-1 placeholder). */
  schemaVersion: string;
  /** ISO-8601 timestamp when the registry was built. */
  snapshotAt: string;
  /** Map of type name → flattened type definition. */
  types: Record<string, TypeDef>;
}

// scripts/build-registry.mjs is the single producer of this file and
// its output shape is asserted against the spec-delta in cycle 1's tests.
const registry = rawRegistry as Registry;

/** Returns the loaded registry. Always the same reference — no re-read. */
export function loadRegistry(): Registry {
  return registry;
}

/**
 * Looks up a type definition by name. O(1).
 * Returns `undefined` when the type isn't in the registry.
 */
export function getTypeDef(name: string): TypeDef | undefined {
  return registry.types[name];
}

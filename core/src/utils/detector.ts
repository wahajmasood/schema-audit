// core/src/utils/detector.ts
//
// Auto-detects the input's structured-data format. Substring sniffing
// rather than full parsing — robust for any input that's recognizably
// one of the supported formats; emits "unknown" for everything else.
//
// Order matters: JSON-LD (starts with `{` or `[`) is checked first
// because it's unambiguous. HTML inputs (start with `<`) are then
// classified by sniffing for Microdata (`itemscope`) or RDFa
// (`typeof=` / `vocab=`). When both Microdata and RDFa indicators
// appear in the same HTML, Microdata wins — RDFa lands in cycle 7
// and reconsiders precedence then.
//
// Pure function. No I/O. No throws.

import type { Format } from "../types.js";

export function detect(input: string): Format {
  if (typeof input !== "string" || input.length === 0) return "unknown";
  const trimmed = input.trimStart();
  if (trimmed.length === 0) return "unknown";

  const first = trimmed.charAt(0);
  if (first === "{" || first === "[") return "jsonld";

  if (first === "<") {
    // Microdata wins when both indicators present (cycle 6).
    // `itemtype` alone routes to Microdata too — broken markup
    // (itemtype without itemscope) should surface NO_ITEMSCOPE,
    // not UNKNOWN_FORMAT.
    if (/\b(?:itemscope|itemtype)\b/i.test(input)) return "microdata";
    if (/\b(?:typeof|vocab)\s*=/i.test(input)) return "rdfa";
    return "unknown";
  }

  return "unknown";
}

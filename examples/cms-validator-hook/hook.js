// cms-validator-hook (JS) — synchronous pre-save validation.
//
// Plug this into your CMS's beforeSave / beforeCreate lifecycle.
// Throws SchemaInvalid on invalid input so the caller's transaction
// rolls back; returns the validation result otherwise (callers can log
// warnings without blocking).

import { validate } from "schema-audit";

export class SchemaInvalid extends Error {
  constructor(result) {
    super(
      `Schema validation failed: ${result.errors
        .map((e) => `${e.code}@${e.path || "(top)"}`)
        .join(", ")}`,
    );
    this.name = "SchemaInvalid";
    this.result = result;
  }
}

export function validateBeforeSave(structuredData) {
  const result = validate(structuredData);
  if (!result.valid) throw new SchemaInvalid(result);
  return result;
}

// Demo:
if (import.meta.url === `file://${process.argv[1]}`) {
  const productDraft = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "New Widget",
    image: "https://example.com/widget.jpg",
    offers: "https://example.com/widget/buy",
  };
  try {
    const r = validateBeforeSave(productDraft);
    console.log(`Saved. ${r.warnings.length} warnings logged.`);
  } catch (err) {
    if (err instanceof SchemaInvalid) {
      console.error(`Rejected: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

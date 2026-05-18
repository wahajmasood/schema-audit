// ai-agent-tool (JS) — expose schema-audit as an LLM tool call.
//
// Use the exported `toolDefinition` and `runTool` with any tool-use
// API (Anthropic, OpenAI). The model passes a structured-data string;
// the tool returns a compact verdict the model can read back.

import { validate } from "schema-audit";

export const toolDefinition = {
  name: "validate_schema",
  description:
    "Validate JSON-LD, Microdata, or RDFa structured data against " +
    "schema.org and Google Rich Results rules. Returns a compact verdict.",
  input_schema: {
    type: "object",
    required: ["input"],
    properties: {
      input: {
        type: "string",
        description:
          "Structured-data input as a string: JSON-LD text, or HTML " +
          "containing Microdata or RDFa markup.",
      },
    },
  },
};

export function runTool({ input }) {
  const result = validate(input);
  return {
    valid: result.valid,
    format: result.format,
    types: result.types,
    error_count: result.errors.length,
    warning_count: result.warnings.length,
    // The model gets the codes — short, deterministic — not the long messages.
    error_codes: result.errors.map((e) => e.code),
    warning_codes: result.warnings.map((w) => w.code),
  };
}

// Demo:
if (import.meta.url === `file://${process.argv[1]}`) {
  const verdict = runTool({
    input: '{"@context":"https://schema.org","@type":"Product","name":"Widget"}',
  });
  console.log(JSON.stringify(verdict, null, 2));
}

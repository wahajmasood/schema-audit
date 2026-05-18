"""ai-agent-tool (Python) — expose schema-audit as an LLM tool call.

Use ``TOOL_DEFINITION`` + ``run_tool`` with any tool-use API
(Anthropic, OpenAI). The model passes a structured-data string; the
tool returns a compact verdict the model can read back.
"""

from __future__ import annotations

from schema_audit import validate

TOOL_DEFINITION: dict[str, object] = {
    "name": "validate_schema",
    "description": (
        "Validate JSON-LD, Microdata, or RDFa structured data against "
        "schema.org and Google Rich Results rules. Returns a compact verdict."
    ),
    "input_schema": {
        "type": "object",
        "required": ["input"],
        "properties": {
            "input": {
                "type": "string",
                "description": (
                    "Structured-data input as a string: JSON-LD text, "
                    "or HTML containing Microdata or RDFa markup."
                ),
            },
        },
    },
}


def run_tool(*, input: str) -> dict[str, object]:  # noqa: A002 — tool API mirrors JS
    result = validate(input)
    return {
        "valid": result["valid"],
        "format": result["format"],
        "types": result["types"],
        "error_count": len(result["errors"]),
        "warning_count": len(result["warnings"]),
        # The model gets the codes — short, deterministic — not the long messages.
        "error_codes": [e["code"] for e in result["errors"]],
        "warning_codes": [w["code"] for w in result["warnings"]],
    }


if __name__ == "__main__":
    import json

    verdict = run_tool(
        input='{"@context":"https://schema.org","@type":"Product","name":"Widget"}'
    )
    print(json.dumps(verdict, indent=2))

# Examples

Four self-contained scenarios showing how to drop `schema-audit` into
different kinds of tools. Each scenario has a JavaScript variant and
a Python variant side-by-side so the cross-language parity is visible
at a glance.

| Example | What it shows |
|---------|---------------|
| [`page-auditor/`](./page-auditor/) | A simple "validate a page" CLI — pipe HTML or JSON-LD in, get issues out, exit code reflects validity. The pattern most users will start with. |
| [`cms-validator-hook/`](./cms-validator-hook/) | A pre-save hook for a CMS: validate the JSON-LD object the editor produced before persisting it. Synchronous, throws on invalid input. |
| [`ai-agent-tool/`](./ai-agent-tool/) | A function suitable for use as an LLM tool call (Anthropic / OpenAI tool-use API). Input: structured-data string. Output: a JSON verdict the model can read back. |
| [`monitor/`](./monitor/) | A short polling script that re-validates a list of URLs on a schedule. Logs regressions. |

Each example is under 30 lines and avoids framework-specific glue —
the goal is to show the SHAPE of the integration, not lock you into
Express / Flask / Anthropic SDK / whatever.

## Running

Examples expect each package installed:

```bash
# JavaScript
cd ../core && npm install && npm run build && npm link
# from any example dir:
node example.js

# Python
cd ../python && pip install -e .
# from any example dir:
python example.py
```

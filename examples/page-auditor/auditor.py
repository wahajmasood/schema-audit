"""page-auditor (Python) — validate structured data from stdin.

Usage:
    cat page.html | python auditor.py
    curl -s https://example.com | python auditor.py

Prints a one-line summary to stdout and any errors/warnings to stderr.
Exits 0 when valid, 1 when invalid.
"""

import sys

from schema_audit import validate

input_text = sys.stdin.read()
result = validate(input_text)

mark = "✓" if result["valid"] else "✗"
types_label = ", ".join(result["types"]) or "(no items)"
print(f"{mark} {types_label} ({result['format']})")

for err in result["errors"]:
    print(
        f"[E] {err['code']} at {err['path'] or '(top)'}: {err['message']}",
        file=sys.stderr,
    )
for warn in result["warnings"]:
    print(
        f"[W] {warn['code']} at {warn['path'] or '(top)'}: {warn['message']}",
        file=sys.stderr,
    )

sys.exit(0 if result["valid"] else 1)

"""monitor (Python) — re-validate a list of URLs on a schedule.

Demo for adoption-style monitoring scripts: read URLs from a file or
stdin, fetch each, validate, log regressions. Sync + stdlib — no
external HTTP client. Pause/sleep/scheduling is left to whatever you
wrap this in (cron, systemd timer, a worker queue).

Usage:
    python monitor.py < urls.txt
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request

from schema_audit import detect, validate


def fetch(url: str, timeout: float = 10.0) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError) as err:
        print(f"[FETCH-FAIL] {url}: {err}", file=sys.stderr)
        return None


def check(url: str) -> None:
    body = fetch(url)
    if body is None:
        return
    result = validate(body)
    if result["valid"]:
        print(f"[OK]   {url}  {result['format']}  {','.join(result['types']) or '-'}")
    else:
        codes = ", ".join(e["code"] for e in result["errors"])
        print(
            f"[FAIL] {url}  {result['format']}  "
            f"types={result['types']}  errors=[{codes}]",
            file=sys.stderr,
        )


if __name__ == "__main__":
    for line in sys.stdin:
        url = line.strip()
        if url and not url.startswith("#"):
            check(url)

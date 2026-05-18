"""Command-line interface for the Python schema-audit package.

Exposes :func:`main` — a pure function taking injected I/O streams,
processing argv, validating input, writing output, and returning an
exit code. Mirrors ``core/src/cli.ts`` 1:1 so the JS and Python CLIs
behave identically on identical inputs.

Real ``sys.argv``, ``sys.stdin``, and ``sys.stdout`` live in
:func:`cli_entry`, the entry point declared in ``pyproject.toml``.
``main`` never touches them, so the whole CLI is testable without
spawning subprocesses.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import NoReturn, TextIO

from . import VERSION, detect, validate
from ._render import render_human
from .types import Format, ValidationResult

_VALID_FORMATS = ("auto", "jsonld", "microdata", "rdfa")

_HELP_TEXT = """schema-audit — validate JSON-LD, Microdata, and RDFa structured data.

Usage:
  schema-audit [validate] [file] [options]
  schema-audit detect [file]
  schema-audit --version
  schema-audit --help

Inputs:
  <file>          Path to a JSON or HTML file
  -               Read from stdin
  (omitted)       Read from stdin

Options:
  --format <fmt>  Override format detection: auto (default) | jsonld | microdata | rdfa
  --strict        Treat warnings as errors (exit code 1 if any warning)
  --json          Output the full ValidationResult as JSON (default: human-readable)
  -h, --help      Show this help
  -v, --version   Print version

Exit codes:
  0   valid
  1   invalid (errors present, or warnings in --strict)
  2   usage error, file read error, or CLI parse failure
"""


ReadFile = Callable[[str], str]


def _default_read_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


class _UsageError(Exception):
    """Raised when argv parsing fails. Mapped to exit code 2."""


class _SilentArgParser(argparse.ArgumentParser):
    """argparse subclass that turns its built-in `exit()` / `error()` into
    a `_UsageError` so we never write to stderr behind the caller's back."""

    def error(self, message: str) -> NoReturn:
        raise _UsageError(message)

    def exit(self, status: int = 0, message: str | None = None) -> NoReturn:
        # Reached only for unrecognized -h printout etc. We handle -h/-v
        # ourselves, so anything reaching here is a parse failure.
        raise _UsageError(message or f"argparse exit {status}")


def _build_parser() -> argparse.ArgumentParser:
    parser = _SilentArgParser(add_help=False, prog="schema-audit")
    parser.add_argument("--format", dest="format", default=None)
    parser.add_argument("--strict", dest="strict", action="store_true")
    parser.add_argument("--json", dest="as_json", action="store_true")
    parser.add_argument("-h", "--help", dest="help", action="store_true")
    parser.add_argument("-v", "--version", dest="version", action="store_true")
    parser.add_argument("positionals", nargs="*")
    return parser


def main(
    *,
    argv: list[str],
    stdin: TextIO | None,
    stdout: TextIO,
    stderr: TextIO,
    read_file: ReadFile | None = None,
) -> int:
    """Process ``argv`` and write output / errors to the injected streams.

    Returns an exit code: ``0`` valid, ``1`` invalid (errors present or
    warnings in strict mode), ``2`` usage error / read failure.

    The four streams (and the optional ``read_file``) are dependencies
    so tests can drive the CLI without spawning subprocesses — the JS
    side took the same shape in cycle 8.
    """
    # 1. Parse argv. parse_intermixed_args lets options appear between
    # positionals (e.g. `validate --strict file.json`) — argparse's
    # default parse_args doesn't.
    try:
        ns = _build_parser().parse_intermixed_args(argv)
    except _UsageError as err:
        stderr.write(f"schema-audit: {err}\n")
        return 2

    # 2. Quick exits.
    if ns.help:
        stdout.write(_HELP_TEXT)
        return 0
    if ns.version:
        stdout.write(f"schema-audit v{VERSION}\n")
        return 0

    # 3. Resolve subcommand + input source.
    positionals: list[str] = ns.positionals
    subcommand: str = "validate"
    input_arg: str | None = None
    if positionals:
        first = positionals[0]
        if first in ("validate", "detect"):
            subcommand = first
            input_arg = positionals[1] if len(positionals) > 1 else None
        else:
            # Implicit `validate` — `schema-audit page.html`
            input_arg = first

    # 4. Validate --format flag.
    format_val: str | None = ns.format
    if format_val is not None and format_val not in _VALID_FORMATS:
        stderr.write(
            f'schema-audit: invalid --format value "{format_val}". '
            f"Allowed: {', '.join(_VALID_FORMATS)}.\n"
        )
        return 2

    # 5. Read input (file or stdin).
    if input_arg is None or input_arg == "-":
        if stdin is None:
            stderr.write(
                "schema-audit: no input. Pass a file path or pipe input to stdin.\n"
            )
            return 2
        try:
            text_input = stdin.read()
        except Exception as err:
            stderr.write(f"schema-audit: failed to read stdin: {err}\n")
            return 2
    else:
        reader = read_file or _default_read_file
        try:
            text_input = reader(input_arg)
        except Exception as err:
            stderr.write(f"schema-audit: cannot read {input_arg}: {err}\n")
            return 2

    # 6. Dispatch.
    if subcommand == "detect":
        stdout.write(detect(text_input) + "\n")
        return 0

    fmt: Format | str = format_val or "auto"
    result: ValidationResult = validate(
        text_input, format=fmt, strict=bool(ns.strict)
    )

    if ns.as_json:
        stdout.write(json.dumps(result, indent=2) + "\n")
    else:
        stdout.write(render_human(result, version=VERSION) + "\n")

    return 0 if result["valid"] else 1


def cli_entry() -> None:
    """Real entry point declared in ``pyproject.toml``.

    Wires real ``sys`` streams into :func:`main` and converts the
    returned int into a ``SystemExit``.
    """
    code = main(
        argv=sys.argv[1:],
        stdin=sys.stdin if not sys.stdin.isatty() else None,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    sys.exit(code)



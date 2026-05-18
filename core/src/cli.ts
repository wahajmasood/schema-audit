// core/src/cli.ts
//
// Command-line interface for schema-audit. Exposes `runCli({...})`
// — a pure function that takes injected I/O streams, processes
// argv, validates input, writes output, and returns an exit code.
//
// Process.exit, real process.argv, and real fs handles all live in
// `bin/schema-audit.js`. This module never touches them, so it's
// testable without spawning child processes.

import { parseArgs } from "node:util";
import { readFile as fsReadFile } from "node:fs/promises";
import { validate, VERSION } from "./index.js";
import { detect } from "./utils/detector.js";
import { renderHuman } from "./cli/render.js";
import type { ValidateOptions } from "./types.js";

type ValidateFormat = NonNullable<ValidateOptions["format"]>;

export interface CliIO {
  /** argv WITHOUT the leading node-binary + script entries. */
  argv: string[];
  stdin?: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  /** Injectable file reader for testing. Defaults to fs.promises.readFile. */
  readFile?: (path: string) => Promise<string>;
}

const HELP_TEXT = `schema-audit — validate JSON-LD, Microdata, and RDFa structured data.

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
`;

const VALID_FORMATS: ReadonlyArray<string> = [
  "auto",
  "jsonld",
  "microdata",
  "rdfa",
];

export async function runCli(io: CliIO): Promise<number> {
  // 1. Parse argv.
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: io.argv,
      options: {
        format: { type: "string" },
        strict: { type: "boolean" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    io.stderr.write(
      `schema-audit: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  const { values, positionals } = parsed;

  // 2. Quick exits.
  if (values["help"] === true) {
    io.stdout.write(HELP_TEXT);
    return 0;
  }
  if (values["version"] === true) {
    io.stdout.write(`schema-audit v${VERSION}\n`);
    return 0;
  }

  // 3. Resolve subcommand + input source.
  let subcommand: "validate" | "detect" = "validate";
  let inputArg: string | undefined;

  if (positionals.length > 0) {
    const first = positionals[0]!;
    if (first === "validate" || first === "detect") {
      subcommand = first;
      inputArg = positionals[1];
    } else {
      // Implicit `validate` — `schema-audit page.html`
      inputArg = first;
    }
  }

  // 4. Validate --format flag.
  const formatVal =
    typeof values["format"] === "string" ? values["format"] : undefined;
  if (formatVal !== undefined && !VALID_FORMATS.includes(formatVal)) {
    io.stderr.write(
      `schema-audit: invalid --format value "${formatVal}". Allowed: ${VALID_FORMATS.join(", ")}.\n`,
    );
    return 2;
  }

  // 5. Read input (file or stdin).
  let input: string;
  if (inputArg === undefined || inputArg === "-") {
    if (!io.stdin) {
      io.stderr.write(
        "schema-audit: no input. Pass a file path or pipe input to stdin.\n",
      );
      return 2;
    }
    try {
      input = await readStream(io.stdin);
    } catch (err) {
      io.stderr.write(
        `schema-audit: failed to read stdin: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 2;
    }
  } else {
    const reader =
      io.readFile ?? ((p: string) => fsReadFile(p, { encoding: "utf8" }));
    try {
      input = await reader(inputArg);
    } catch (err) {
      io.stderr.write(
        `schema-audit: cannot read ${inputArg}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 2;
    }
  }

  // 6. Dispatch on subcommand.
  if (subcommand === "detect") {
    io.stdout.write(detect(input) + "\n");
    return 0;
  }

  const options: ValidateOptions = {};
  if (formatVal !== undefined) options.format = formatVal as ValidateFormat;
  if (values["strict"] === true) options.strict = true;

  const result = validate(input, options);

  if (values["json"] === true) {
    io.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    io.stdout.write(renderHuman(result, { version: VERSION }) + "\n");
  }

  return result.valid ? 0 : 1;
}

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk,
      );
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

#!/usr/bin/env node
// schema-audit CLI launcher.
// Tiny shebang wrapper around the compiled CLI module.
// All real logic lives in src/cli.ts -> dist/cli.js.

import { runCli } from "../dist/cli.js";

const code = await runCli({
  argv: process.argv.slice(2),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exit(code);

// monitor (JS) — re-validate a list of URLs on a schedule.
//
// Reads URLs from stdin, fetches each, validates, logs regressions.
// Pause/sleep/scheduling is left to whatever wraps this (cron,
// systemd timer, a worker queue).
//
// Usage:
//   cat urls.txt | node monitor.js

import { createInterface } from "node:readline";
import { validate } from "schema-audit";

async function fetchBody(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
    return await res.text();
  } catch (err) {
    console.error(`[FETCH-FAIL] ${url}: ${err.message}`);
    return null;
  }
}

async function check(url) {
  const body = await fetchBody(url);
  if (body === null) return;
  const result = validate(body);
  if (result.valid) {
    console.log(
      `[OK]   ${url}  ${result.format}  ${result.types.join(",") || "-"}`,
    );
  } else {
    const codes = result.errors.map((e) => e.code).join(", ");
    console.error(
      `[FAIL] ${url}  ${result.format}  ` +
        `types=${JSON.stringify(result.types)}  errors=[${codes}]`,
    );
  }
}

const rl = createInterface({ input: process.stdin });
for await (const line of rl) {
  const url = line.trim();
  if (url && !url.startsWith("#")) await check(url);
}

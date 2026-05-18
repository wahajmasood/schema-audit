import { defineConfig } from "tsup";

// Cycle 11 — dist/cli.js used to inline the whole validator (~460 KB
// duplicated in both bundles). `splitting: true` makes tsup factor out
// the shared chunk so cli.js is a thin wrapper that imports the
// validator at runtime. ESM gets the chunked layout; CJS falls back to
// per-entry bundles (CJS doesn't support code-splitting in tsup).
export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  outDir: "dist",
  target: "es2022",
  minify: false,
});
